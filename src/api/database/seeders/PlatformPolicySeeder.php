<?php

namespace Database\Seeders;

use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\UserRole;
use App\Models\PlatformPolicy;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use InvalidArgumentException;

class PlatformPolicySeeder extends Seeder
{
    private const FIXTURE_PATH = 'seeders/data/platform-policies.json';

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('Development placeholder policies were not seeded in production. Import approved policy content through the Platform Settings workflow.');

            return;
        }

        $admin = User::query()
            ->where('role', UserRole::Admin)
            ->orderBy('created_at')
            ->first();

        if (! $admin) {
            $this->command?->warn('Platform policies were not seeded: create an Admin account first.');

            return;
        }

        DB::transaction(function () use ($admin): void {
            foreach ($this->definitions() as $definition) {
                $this->seedDefinition($admin, $definition);
            }
        });
    }

    /** @return list<array{type: PlatformPolicyType, version: int, title: string, content: string, change_summary: ?string, requires_reconsent: bool, status: PlatformPolicyVersionStatus}> */
    private function definitions(): array
    {
        $path = database_path(self::FIXTURE_PATH);
        $payload = json_decode(File::get($path), true, 512, JSON_THROW_ON_ERROR);

        if (! is_array($payload) || ! is_array($payload['policies'] ?? null)) {
            throw new InvalidArgumentException('The platform policy fixture must contain a policies array.');
        }

        $definitions = [];
        foreach ($payload['policies'] as $definition) {
            if (! is_array($definition)) {
                throw new InvalidArgumentException('Each platform policy fixture entry must be an object.');
            }

            $type = PlatformPolicyType::tryFrom((string) ($definition['type'] ?? ''));
            $status = PlatformPolicyVersionStatus::tryFrom((string) ($definition['status'] ?? ''));
            $version = $definition['version'] ?? null;
            $title = trim((string) ($definition['title'] ?? ''));
            $content = trim((string) ($definition['content'] ?? ''));

            if (! $type || ! $status || $status !== PlatformPolicyVersionStatus::Published) {
                throw new InvalidArgumentException('Platform policy fixture entries must use an allow-listed type and published status.');
            }

            if (! is_int($version) || $version < 1 || $title === '' || $content === '') {
                throw new InvalidArgumentException('Platform policy fixture entries require a positive version, title, and content.');
            }

            $definitions[] = [
                'type' => $type,
                'version' => $version,
                'title' => $title,
                'content' => $content,
                'change_summary' => isset($definition['change_summary']) ? trim((string) $definition['change_summary']) : null,
                'requires_reconsent' => (bool) ($definition['requires_reconsent'] ?? false),
                'status' => $status,
            ];
        }

        return $definitions;
    }

    /** @param array{type: PlatformPolicyType, version: int, title: string, content: string, change_summary: ?string, requires_reconsent: bool, status: PlatformPolicyVersionStatus} $definition */
    private function seedDefinition(User $admin, array $definition): void
    {
        $policy = PlatformPolicy::query()->firstOrCreate(['type' => $definition['type']->value]);
        $policy = PlatformPolicy::query()->whereKey($policy->id)->lockForUpdate()->firstOrFail();

        if ($policy->versions()->exists()) {
            $this->command?->line("Skipped {$definition['type']->value}: existing policy versions were preserved.");

            return;
        }

        $publishedAt = now();
        $version = $policy->versions()->create([
            'version' => $definition['version'],
            'title' => $definition['title'],
            'content' => $definition['content'],
            'status' => $definition['status'],
            'requires_reconsent' => $definition['requires_reconsent'],
            'revision' => 1,
            'created_by_admin_id' => $admin->id,
            'published_by_admin_id' => $admin->id,
            'published_at' => $publishedAt,
            'change_summary' => $definition['change_summary'],
        ]);

        $policy->update(['current_version_id' => $version->id]);
        $this->command?->info("Seeded {$definition['type']->value} version {$definition['version']}.");
    }
}
