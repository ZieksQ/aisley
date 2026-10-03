<?php

namespace App\Services\Finance;

use App\Models\CommissionPolicy;
use Illuminate\Support\Facades\DB;

class CommissionPolicyService
{
    public function publish(string $policyId, string $adminId): CommissionPolicy
    {
        return DB::transaction(function () use ($policyId, $adminId): CommissionPolicy {
            $beneficiary = CommissionPolicy::query()->findOrFail($policyId)->beneficiary_type;
            // Lock in one stable order so simultaneous publications for the same
            // beneficiary cannot produce overlapping effective windows.
            $policies = CommissionPolicy::query()->where('beneficiary_type', $beneficiary)
                ->orderBy('id')->lockForUpdate()->get();
            $record = $policies->firstWhere('id', $policyId);
            abort_if($record->status !== 'draft', 409, 'Only unpublished commission policies can be published.');

            // Publication cannot rewrite commissions already used by Orders.
            $effectiveAt = $record->effective_at?->isFuture() ? $record->effective_at : now();
            $published = $policies->where('status', 'published');
            $next = $published->filter(fn (CommissionPolicy $policy) => $policy->effective_at?->greaterThan($effectiveAt))
                ->sortBy('effective_at')->first();

            foreach ($published as $policy) {
                if ($policy->effective_at?->lessThanOrEqualTo($effectiveAt)
                    && ($policy->ends_at === null || $policy->ends_at->greaterThan($effectiveAt))) {
                    $policy->update(['ends_at' => $effectiveAt]);
                }
            }

            $record->update([
                'status' => 'published',
                'effective_at' => $effectiveAt,
                'ends_at' => $next?->effective_at,
                'published_by_admin_id' => $adminId,
                'revision' => $record->revision + 1,
            ]);

            return $record->refresh();
        });
    }
}
