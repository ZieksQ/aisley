<?php

namespace App\Services\Audit;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\AdminAuditAction;
use App\Enums\UserRole;
use App\Jobs\Admin\PersistAuditLog;
use App\Models\AuditOutbox;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Throwable;

class AuditService
{
    public function __construct(private readonly AuditPayloadSanitizer $sanitizer) {}

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @param  array<string, mixed>  $targetSnapshot
     * @param  array<string, mixed>  $metadata
     */
    public function record(
        User $actor,
        AdminAuditAction $action,
        AuditSourceFeature $sourceFeature,
        Model $target,
        array $before = [],
        array $after = [],
        array $targetSnapshot = [],
        array $metadata = [],
        ?Carbon $occurredAt = null,
        ?string $ipAddress = null,
        ?string $userAgent = null,
        ?string $requestId = null,
    ): string {
        if ($actor->role !== UserRole::Admin) {
            throw new InvalidArgumentException('Only Admin actions belong in the Admin audit ledger.');
        }

        $before = $this->sanitizer->sanitize($before);
        $after = $this->sanitizer->sanitize($after);
        $eventId = (string) Str::uuid7();

        AuditOutbox::create([
            'id' => $eventId,
            'actor_id' => $actor->id,
            'actor_name' => $this->actorName($actor),
            'action' => $action->value,
            'source_feature' => $sourceFeature->value,
            'auditable_type' => $target->getMorphClass(),
            'auditable_id' => $target->getKey(),
            'target_snapshot' => $this->sanitizer->sanitize($targetSnapshot),
            'old_values' => $before,
            'new_values' => $after,
            'changed_fields' => $this->changedFields($before, $after),
            'metadata' => $this->sanitizer->sanitize($metadata),
            'request_id' => $requestId
                ? Str::limit($requestId, 64, '')
                : (string) Str::uuid7(),
            'schema_version' => 1,
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent ? Str::limit($userAgent, 1000) : null,
            'occurred_at' => $occurredAt ?? now(),
            'available_at' => now(),
        ]);

        $dispatch = static function () use ($eventId): void {
            try {
                PersistAuditLog::dispatch($eventId);
            } catch (Throwable $exception) {
                report($exception);
            }
        };

        if (DB::transactionLevel() > 0) {
            DB::afterCommit($dispatch);
        } else {
            $dispatch();
        }

        return $eventId;
    }

    /** @return array<int, string> */
    private function changedFields(array $before, array $after): array
    {
        $fields = array_values(array_unique([...array_keys($before), ...array_keys($after)]));
        sort($fields);

        return $fields;
    }

    private function actorName(User $actor): string
    {
        $actor->loadMissing('adminProfile');
        $name = trim(implode(' ', array_filter([
            $actor->adminProfile?->first_name,
            $actor->adminProfile?->last_name,
        ])));

        return $name !== '' ? $name : $actor->email;
    }
}
