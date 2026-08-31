<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;

class SellerComplianceCaseDetailResource extends SellerComplianceCaseSummaryResource
{
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'source' => [
                'type' => $this->source_type,
                'reference_id' => $this->source_reference_id,
            ],
            'dismissal_note' => $this->dismissal_note,
            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
            'dismissed_at' => $this->dismissed_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'actions' => $this->actions->map(fn ($action) => [
                'id' => $action->id,
                'action' => $action->action->value,
                'label' => $action->action->label(),
                'reason' => $action->reason,
                'actor' => [
                    'id' => $action->actor->id,
                    'email' => $action->actor->email,
                ],
                'restriction_id' => $action->restriction_id,
                'account_lifecycle_event_id' => $action->account_lifecycle_event_id,
                'occurred_at' => $action->occurred_at?->toIso8601String(),
            ])->values(),
            'restrictions' => $this->restrictions->map(fn ($restriction) => [
                'id' => $restriction->id,
                'reason' => $restriction->reason,
                'is_active' => $restriction->active_marker === 'active' && $restriction->revoked_at === null,
                'imposed_at' => $restriction->imposed_at?->toIso8601String(),
                'revoked_at' => $restriction->revoked_at?->toIso8601String(),
                'revocation_reason' => $restriction->revocation_reason,
            ])->values(),
        ];
    }
}
