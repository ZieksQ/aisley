<?php

namespace App\Services\Finance;

use App\Enums\PaymentMethod;
use App\Models\CourierCashCredit;
use App\Models\CourierCashObligation;
use App\Models\CourierCashReceipt;
use App\Models\CourierCashReceiptItem;
use App\Models\DeliveryTask;
use App\Models\LogisticsOrganization;
use App\Models\Order;
use App\Models\User;
use App\Services\Finance\Automation\CodInvoiceService;
use App\Services\Finance\Gateway\LogisticsBillingService;
use Illuminate\Support\Facades\DB;

class CourierCashService
{
    public function recordDelivery(Order $order, DeliveryTask $task, string $organizationId, mixed $at): void
    {
        if ($order->payment_method !== PaymentMethod::CashOnDelivery) {
            return;
        }
        $courier = $task->courier()->with('courierProfile')->firstOrFail();
        CourierCashObligation::query()->firstOrCreate(['order_id' => $order->id], [
            'delivery_task_id' => $task->id, 'courier_id' => $courier->id,
            'logistics_organization_id' => $organizationId, 'courier_name' => $this->courierName($courier),
            'order_reference' => $order->reference, 'currency' => $order->currency,
            'amount_cents' => app(CodInvoiceService::class)->cents($order->payable_total), 'delivered_at' => $at,
        ]);
    }

    public function receive(User $logistics, array $ids, string $key): CourierCashReceipt
    {
        sort($ids);
        $hash = hash('sha256', json_encode($ids, JSON_THROW_ON_ERROR));
        $organization = $logistics->logisticsOrganization()->firstOrFail();

        return DB::transaction(function () use ($organization, $logistics, $ids, $key, $hash) {
            // Serialize organization retry keys, then obligations, receipt/credit, and gateway account.
            LogisticsOrganization::query()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $items = CourierCashObligation::query()->whereIn('id', $ids)
                ->where('logistics_organization_id', $organization->id)->orderBy('id')->lockForUpdate()->get();
            abort_unless($items->count() === count($ids), 404);
            $existing = CourierCashReceipt::query()->where('logistics_organization_id', $organization->id)->where('idempotency_key', $key)->first();
            if ($existing !== null) {
                abort_unless(hash_equals($existing->request_hash, $hash), 409, 'This receipt key was used for another selection.');

                return $existing->load(['items.obligation', 'credit']);
            }
            abort_if($items->contains(fn ($item) => $item->received_at !== null), 409, 'Cash for one or more Orders was already received. Refresh the balance.');
            abort_unless($items->pluck('courier_id')->unique()->count() === 1 && $items->pluck('currency')->unique()->count() === 1, 422, 'Select Orders from one Courier and currency.');
            $total = $items->sum('amount_cents');
            abort_unless($total > 0, 422, 'The selected cash balance must be positive.');
            $receipt = CourierCashReceipt::create([
                'logistics_organization_id' => $organization->id, 'courier_id' => $items->first()->courier_id,
                'courier_name' => $items->first()->courier_name, 'received_by' => $logistics->id,
                'currency' => $items->first()->currency, 'total_cents' => $total,
                'idempotency_key' => $key, 'request_hash' => $hash, 'received_at' => now(),
            ]);
            foreach ($items as $item) {
                CourierCashReceiptItem::create(['courier_cash_receipt_id' => $receipt->id, 'courier_cash_obligation_id' => $item->id, 'amount_cents' => $item->amount_cents]);
                $item->update(['received_at' => $receipt->received_at]);
            }
            $account = app(LogisticsBillingService::class)->provision($organization);
            $credit = CourierCashCredit::create(['courier_cash_receipt_id' => $receipt->id,
                'sandbox_gateway_account_id' => $account->id, 'amount_cents' => $total, 'currency' => $receipt->currency]);
            app(CourierCashCreditService::class)->apply($credit->id);

            return $receipt->load(['items.obligation', 'credit']);
        }, 3);
    }

    private function courierName(User $courier): string
    {
        return trim(implode(' ', array_filter([$courier->courierProfile?->first_name, $courier->courierProfile?->last_name]))) ?: 'Courier';
    }
}
