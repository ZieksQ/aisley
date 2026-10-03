<?php

namespace App\Http\Resources\Admin;

use App\Enums\CommissionPolicyStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CommissionPolicyResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $now = now();
        $status = CommissionPolicyStatus::Inactive;
        if ($this->status === 'published' && $this->ends_at?->lessThanOrEqualTo($now)) {
            $status = CommissionPolicyStatus::Expired;
        } elseif ($this->effective_at?->greaterThan($now)) {
            $status = CommissionPolicyStatus::Scheduled;
        } elseif ($this->status === 'published' && $this->effective_at !== null) {
            $status = CommissionPolicyStatus::Active;
        }

        return [
            'id' => $this->id,
            'beneficiary_type' => $this->beneficiary_type,
            'rate_basis_points' => $this->rate_basis_points,
            'status' => $status->value,
            'can_publish' => $this->status === 'draft',
            'effective_at' => $this->effective_at?->toISOString(),
            'ends_at' => $this->ends_at?->toISOString(),
            'revision' => $this->revision,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
