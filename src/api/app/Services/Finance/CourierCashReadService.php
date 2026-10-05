<?php

namespace App\Services\Finance;

use App\Models\CourierCashObligation;
use Illuminate\Database\Eloquent\Builder;

class CourierCashReadService
{
    public function outstanding(string $organizationId, array $filters): Builder
    {
        return CourierCashObligation::query()->where('logistics_organization_id', $organizationId)->whereNull('received_at')
            ->when($filters['courier_id'] ?? null, fn ($q, $id) => $q->where('courier_id', $id))
            ->when($filters['currency'] ?? null, fn ($q, $currency) => $q->where('currency', $currency));
    }

    public function balances(string $organizationId): array
    {
        return $this->outstanding($organizationId, [])->selectRaw('courier_id, MAX(courier_name) AS courier_name, currency, SUM(amount_cents) AS outstanding_cents, COUNT(*) AS order_count')
            ->groupBy('courier_id', 'currency')->orderBy('courier_name')->get()->map(fn ($row) => [
                'courier_id' => $row->courier_id, 'courier_name' => $row->courier_name, 'currency' => $row->currency,
                'outstanding_cents' => (int) $row->outstanding_cents, 'order_count' => (int) $row->order_count,
            ])->all();
    }
}
