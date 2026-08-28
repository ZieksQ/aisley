<?php

namespace App\Http\Resources\Admin;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\Admin\AuditTargetType;
use App\Enums\AdminAuditAction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class AuditLogSummaryResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $targetType = AuditTargetType::fromModelClass($this->auditable_type);
        $sourceFeature = AuditSourceFeature::tryFrom($this->source_feature);
        $action = AdminAuditAction::tryFrom($this->action);

        return [
            'id' => $this->id,
            'event_id' => $this->id,
            'occurred_at' => $this->occurred_at?->toIso8601String(),
            'recorded_at' => $this->created_at?->toIso8601String(),
            'actor' => [
                'id' => $this->actor_id,
                'name' => $this->actor_name ?: $this->currentActorName(),
                'email' => $this->actor?->email,
            ],
            'source_feature' => $this->source_feature,
            'source_feature_label' => $sourceFeature?->label() ?? $this->fallbackLabel($this->source_feature),
            'action' => $this->action,
            'action_label' => $action?->label() ?? $this->fallbackLabel($this->action),
            'target' => [
                'type' => $targetType?->value ?? Str::snake(class_basename($this->auditable_type)),
                'type_label' => $targetType?->label() ?? Str::headline(class_basename($this->auditable_type)),
                'id' => $this->auditable_id,
                'snapshot' => $this->target_snapshot ?? [],
            ],
        ];
    }

    private function currentActorName(): string
    {
        if (! $this->actor) {
            return 'Former administrator';
        }

        $name = trim(implode(' ', array_filter([
            $this->actor->adminProfile?->first_name,
            $this->actor->adminProfile?->last_name,
        ])));

        return $name !== '' ? $name : $this->actor->email;
    }

    private function fallbackLabel(string $value): string
    {
        return Str::headline(str_replace('.', '_', $value));
    }
}
