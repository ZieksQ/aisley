<?php

namespace App\Services\Audit;

use App\Models\AuditLog;
use App\Models\AuditOutbox;
use Illuminate\Support\Facades\DB;

class AuditWriter
{
    public function persist(string $eventId): void
    {
        DB::transaction(function () use ($eventId): void {
            $event = AuditOutbox::query()
                ->whereKey($eventId)
                ->lockForUpdate()
                ->first();

            if (! $event || $event->processed_at) {
                return;
            }

            AuditLog::query()->firstOrCreate(
                ['id' => $event->id],
                [
                    'actor_id' => $event->actor_id,
                    'actor_name' => $event->actor_name,
                    'action' => $event->action,
                    'source_feature' => $event->source_feature,
                    'auditable_type' => $event->auditable_type,
                    'auditable_id' => $event->auditable_id,
                    'target_snapshot' => $event->target_snapshot,
                    'old_values' => $event->old_values,
                    'new_values' => $event->new_values,
                    'changed_fields' => $event->changed_fields,
                    'metadata' => $event->metadata,
                    'request_id' => $event->request_id,
                    'schema_version' => $event->schema_version,
                    'occurred_at' => $event->occurred_at,
                    'ip_address' => $event->ip_address,
                    'user_agent' => $event->user_agent,
                    'created_at' => now(),
                ],
            );

            $event->forceFill([
                'processed_at' => now(),
                'last_error' => null,
            ])->save();
        });
    }
}
