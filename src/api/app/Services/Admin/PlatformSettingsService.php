<?php

namespace App\Services\Admin;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\AdminAuditAction;
use App\Enums\AnnouncementStatus;
use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Models\Announcement;
use App\Models\PlatformPolicy;
use App\Models\PlatformPolicyVersion;
use App\Models\User;
use App\Services\Audit\AuditService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class PlatformSettingsService
{
    public function __construct(private readonly AuditService $auditService) {}

    public function createAnnouncement(User $admin, array $data, array $context): Announcement
    {
        return DB::transaction(function () use ($admin, $data, $context) {
            $announcement = Announcement::create([...$data, 'status' => AnnouncementStatus::Draft, 'created_by_admin_id' => $admin->id, 'updated_by_admin_id' => $admin->id]);
            $this->audit($admin, AdminAuditAction::AnnouncementCreated, $announcement, $context, ['status' => 'draft']);

            return $announcement;
        });
    }

    public function updateAnnouncement(User $admin, Announcement $announcement, array $data, array $context): Announcement
    {
        return DB::transaction(function () use ($admin, $announcement, $data, $context) {
            $locked = Announcement::whereKey($announcement->id)->lockForUpdate()->firstOrFail();
            $this->assertRevision($locked->revision, $data['revision']);
            if ($locked->status !== AnnouncementStatus::Draft) {
                throw new ConflictHttpException('Only draft announcements can be edited.');
            }
            $locked->update([...collect($data)->except('revision')->all(), 'revision' => $locked->revision + 1, 'updated_by_admin_id' => $admin->id]);
            $this->audit($admin, AdminAuditAction::AnnouncementUpdated, $locked, $context, ['revision' => $locked->revision]);

            return $locked;
        });
    }

    public function publishAnnouncement(User $admin, Announcement $announcement, int $revision, array $context): Announcement
    {
        $result = DB::transaction(function () use ($admin, $announcement, $revision, $context) {
            $locked = Announcement::whereKey($announcement->id)->lockForUpdate()->firstOrFail();
            $this->assertRevision($locked->revision, $revision);
            if ($locked->status !== AnnouncementStatus::Draft) {
                throw new ConflictHttpException('Only draft announcements can be published.');
            }
            $locked->update(['status' => AnnouncementStatus::Published, 'published_at' => now(), 'revision' => $locked->revision + 1, 'updated_by_admin_id' => $admin->id]);
            $this->audit($admin, AdminAuditAction::AnnouncementPublished, $locked, $context, ['status' => 'published']);

            return $locked;
        });
        Cache::forget(Announcement::ACTIVE_CACHE_KEY);

        return $result;
    }

    public function archiveAnnouncement(User $admin, Announcement $announcement, int $revision, array $context): Announcement
    {
        $result = DB::transaction(function () use ($admin, $announcement, $revision, $context) {
            $locked = Announcement::whereKey($announcement->id)->lockForUpdate()->firstOrFail();
            $this->assertRevision($locked->revision, $revision);
            if ($locked->status !== AnnouncementStatus::Published) {
                throw new ConflictHttpException('Only published announcements can be archived.');
            }
            $locked->update(['status' => AnnouncementStatus::Archived, 'revision' => $locked->revision + 1, 'updated_by_admin_id' => $admin->id]);
            $this->audit($admin, AdminAuditAction::AnnouncementArchived, $locked, $context, ['status' => 'archived']);

            return $locked;
        });
        Cache::forget(Announcement::ACTIVE_CACHE_KEY);

        return $result;
    }

    public function createPolicyVersion(User $admin, PlatformPolicyType $type, array $data, array $context): PlatformPolicyVersion
    {
        return DB::transaction(function () use ($admin, $type, $data, $context) {
            $now = now();
            DB::table('platform_policies')->insertOrIgnore([
                'id' => (string) Str::uuid7(),
                'type' => $type->value,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $policy = PlatformPolicy::where('type', $type)->lockForUpdate()->firstOrFail();
            $version = $policy->versions()->create([...$data, 'version' => ((int) $policy->versions()->max('version')) + 1, 'status' => PlatformPolicyVersionStatus::Draft, 'created_by_admin_id' => $admin->id]);
            $this->audit($admin, AdminAuditAction::PolicyVersionCreated, $version, $context, ['policy_type' => $type->value, 'version' => $version->version]);

            return $version;
        });
    }

    public function updatePolicyVersion(User $admin, PlatformPolicyVersion $version, array $data, array $context): PlatformPolicyVersion
    {
        return DB::transaction(function () use ($admin, $version, $data, $context) {
            $locked = PlatformPolicyVersion::whereKey($version->id)->lockForUpdate()->firstOrFail();
            $this->assertRevision($locked->revision, $data['revision']);
            if ($locked->status !== PlatformPolicyVersionStatus::Draft) {
                throw new ConflictHttpException('Published policy versions are immutable.');
            }
            $locked->update([...collect($data)->except('revision')->all(), 'revision' => $locked->revision + 1]);
            $this->audit($admin, AdminAuditAction::PolicyVersionUpdated, $locked, $context, ['policy_type' => $locked->policy->type->value, 'version' => $locked->version]);

            return $locked;
        });
    }

    public function createPolicySuccessor(User $admin, PlatformPolicyVersion $version, ?string $changeSummary, array $context): PlatformPolicyVersion
    {
        return DB::transaction(function () use ($admin, $version, $changeSummary, $context) {
            $policy = PlatformPolicy::whereKey($version->platform_policy_id)->lockForUpdate()->firstOrFail();
            $source = PlatformPolicyVersion::whereKey($version->id)->lockForUpdate()->firstOrFail();

            if ($source->status !== PlatformPolicyVersionStatus::Published || $policy->current_version_id !== $source->id) {
                throw new ConflictHttpException('Only the current published policy version can be edited into a successor draft.');
            }

            $existing = PlatformPolicyVersion::query()
                ->where('source_policy_version_id', $source->id)
                ->where('status', PlatformPolicyVersionStatus::Draft)
                ->first();

            if ($existing) {
                return $existing;
            }

            $successor = $policy->versions()->create([
                'source_policy_version_id' => $source->id,
                'version' => ((int) $policy->versions()->max('version')) + 1,
                'title' => $source->title,
                'content' => $source->content,
                'change_summary' => $changeSummary,
                'status' => PlatformPolicyVersionStatus::Draft,
                'requires_reconsent' => $source->requires_reconsent,
                'created_by_admin_id' => $admin->id,
            ]);

            $this->audit($admin, AdminAuditAction::PolicySuccessorCreated, $successor, $context, [
                'policy_type' => $policy->type->value,
                'source_policy_version_id' => $source->id,
                'source_version' => $source->version,
                'version' => $successor->version,
            ]);

            return $successor;
        });
    }

    public function publishPolicyVersion(User $admin, PlatformPolicyVersion $version, int $revision, array $context): PlatformPolicyVersion
    {
        $result = DB::transaction(function () use ($admin, $version, $revision, $context) {
            $policy = PlatformPolicy::whereKey($version->platform_policy_id)->lockForUpdate()->firstOrFail();
            $locked = PlatformPolicyVersion::whereKey($version->id)->lockForUpdate()->firstOrFail();
            $this->assertRevision($locked->revision, $revision);
            if ($locked->status !== PlatformPolicyVersionStatus::Draft) {
                throw new ConflictHttpException('Only draft policy versions can be published.');
            }
            if ($policy->current_version_id) {
                PlatformPolicyVersion::whereKey($policy->current_version_id)->update(['status' => PlatformPolicyVersionStatus::Superseded, 'revision' => DB::raw('revision + 1')]);
            }
            $locked->update(['status' => PlatformPolicyVersionStatus::Published, 'published_by_admin_id' => $admin->id, 'published_at' => now(), 'revision' => $locked->revision + 1]);
            $policy->update(['current_version_id' => $locked->id]);
            $this->audit($admin, AdminAuditAction::PolicyVersionPublished, $locked, $context, ['policy_type' => $policy->type->value, 'version' => $locked->version, 'requires_reconsent' => $locked->requires_reconsent]);

            return $locked->load('policy');
        });
        Cache::forget($result->policy->cacheKey());

        return $result;
    }

    private function assertRevision(int $current, int $submitted): void
    {
        if ($current !== $submitted) {
            throw new ConflictHttpException('This content changed in another session. Refresh and review the latest version.');
        }
    }

    private function audit(User $admin, AdminAuditAction $action, $target, array $context, array $metadata): void
    {
        $this->auditService->record(actor: $admin, action: $action, sourceFeature: AuditSourceFeature::PlatformSettings, target: $target, targetSnapshot: ['id' => $target->id], metadata: $metadata, ipAddress: $context['ip_address'] ?? null, userAgent: $context['user_agent'] ?? null, requestId: $context['request_id'] ?? null);
    }
}
