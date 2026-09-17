<?php

namespace App\Services\Admin;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\AdminAuditAction;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\HubConnection;
use App\Models\HubServiceArea;
use App\Models\LogisticsHub;
use App\Models\User;
use App\Services\Audit\AuditService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class HubRoutingConfigurationService
{
    public function __construct(private readonly AuditService $audit) {}

    public function model(string $kind): string
    {
        return $kind === 'service-areas' ? HubServiceArea::class : HubConnection::class;
    }

    public function write(User $admin, string $kind, array $input, ?string $id, array $context): Model
    {
        return DB::transaction(function () use ($admin, $kind, $input, $id, $context): Model {
            // Lock the same small platform configuration mutex for creates and activation races.
            DB::table('permissions')->where('slug', 'platform-settings.manage')->lockForUpdate()->firstOrFail();
            $model = $this->model($kind);
            $record = $id === null ? null : $model::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $before = $record?->only(['is_active', 'revision']) ?? [];
            if ($record !== null && $record->revision !== (int) $input['expected_revision']) {
                throw FulfillmentException::conflict('HUB_CONFIGURATION_REVISION_CONFLICT', 'The configuration changed. Refresh before editing.');
            }
            $data = $record?->toArray() ?? $input;
            $active = (bool) ($input['is_active'] ?? true);
            $hubIds = $kind === 'service-areas' ? [$data['logistics_hub_id']] : [$data['from_hub_id'], $data['to_hub_id']];
            if ($active && LogisticsHub::query()->whereIn('id', $hubIds)->whereHas('organization.user', fn ($q) => $q->where('status', UserStatus::Active))->count() !== count(array_unique($hubIds))) {
                throw FulfillmentException::invalid('HUB_UNAVAILABLE', 'Select an active operational hub.');
            }
            if (! $active && LogisticsHub::query()->whereIn('id', $hubIds)->count() !== count(array_unique($hubIds))) {
                throw FulfillmentException::invalid('HUB_UNAVAILABLE', 'Select an existing operational hub.');
            }
            if ($kind === 'connections' && $data['from_hub_id'] === $data['to_hub_id']) {
                throw FulfillmentException::invalid('HUB_CONNECTION_INVALID', 'A connection requires different hubs.');
            }
            $duplicate = $model::query()->when($id, fn ($q) => $q->where('id', '!=', $id));
            if ($kind === 'service-areas') {
                $duplicate->where('postal_code', $data['postal_code'])->where('is_active', true);
                $conflict = $active && $duplicate->exists();
            } else {
                $conflict = $duplicate->where('from_hub_id', $data['from_hub_id'])->where('to_hub_id', $data['to_hub_id'])->exists();
            }
            if ($conflict) {
                throw FulfillmentException::conflict('HUB_CONFIGURATION_DUPLICATE', 'This active postal destination or directed connection already exists.');
            }
            if ($record === null) {
                $record = $model::create([...$input, 'is_active' => $active, 'created_by' => $admin->id]);
            } else {
                $record->update(['is_active' => $active, 'revision' => $record->revision + 1]);
            }
            $this->audit->record(actor: $admin, action: AdminAuditAction::HubRoutingConfigurationUpdated, sourceFeature: AuditSourceFeature::PlatformSettings,
                target: $record, before: $before, after: $record->only(['is_active', 'revision']), targetSnapshot: ['id' => $record->id], metadata: ['kind' => $kind],
                ipAddress: $context['ip_address'], userAgent: $context['user_agent'], requestId: $context['request_id']);

            return $record;
        }, 3);
    }
}
