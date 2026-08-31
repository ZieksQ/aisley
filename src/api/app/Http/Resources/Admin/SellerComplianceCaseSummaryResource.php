<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerComplianceCaseSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'reason' => $this->reason,
            'revision' => $this->revision,
            'seller' => [
                'id' => $this->seller->id,
                'email' => $this->seller->email,
                'name' => $this->sellerName(),
                'status' => $this->seller->status->value,
                'shop_name' => $this->seller->shop?->name,
            ],
            'product' => $this->product ? [
                'id' => $this->product->id,
                'name' => $this->product->name,
                'status' => $this->product->status->value,
                'is_restricted' => $this->product->activeComplianceRestriction !== null,
            ] : null,
            'policy' => $this->policyVersion ? [
                'id' => $this->policyVersion->id,
                'title' => $this->policyVersion->title,
                'version' => $this->policyVersion->version,
                'type' => $this->policyVersion->policy->type->value,
            ] : null,
            'created_by' => [
                'id' => $this->creator->id,
                'email' => $this->creator->email,
            ],
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    private function sellerName(): string
    {
        $name = trim(implode(' ', array_filter([
            $this->seller->sellerProfile?->first_name,
            $this->seller->sellerProfile?->last_name,
        ])));

        return $name !== '' ? $name : $this->seller->email;
    }
}
