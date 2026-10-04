<?php

namespace App\Services\Finance\Automation;

use App\Enums\CodInvoiceStatus;
use App\Enums\PaymentMethod;
use App\Jobs\Finance\IssueCodInvoiceDocument;
use App\Models\CodInvoice;
use App\Models\LogisticsOrganization;
use App\Models\Order;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class CodInvoiceService
{
    public function __construct(private readonly FinanceSettingsService $settings) {}

    public function issue(Order $order, ?string $collectorId, mixed $deliveredAt, ?string $reviewReason = null): ?CodInvoice
    {
        if ($order->payment_method !== PaymentMethod::CashOnDelivery) {
            return null;
        }

        return DB::transaction(function () use ($order, $collectorId, $deliveredAt, $reviewReason) {
            Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $existing = CodInvoice::query()->where('order_id', $order->id)->first();
            if ($existing !== null) {
                return $existing;
            }
            $at = CarbonImmutable::parse($deliveredAt);
            $settings = $this->settings->platform();
            $collector = $collectorId ? LogisticsOrganization::findOrFail($collectorId) : null;
            $invoice = CodInvoice::create([
                'order_id' => $order->id, 'order_reference' => $order->reference,
                'reference' => 'COD-'.strtoupper(str_replace('-', '', $order->id)),
                'logistics_organization_id' => $collectorId, 'collector_name' => $collector?->business_name,
                'currency' => $order->currency, 'total_cents' => $this->cents($order->payable_total),
                'status' => $collectorId === null ? CodInvoiceStatus::Review : CodInvoiceStatus::Outstanding,
                'review_reason' => $reviewReason, 'delivered_at' => $at,
                'due_at' => $at->addHours($settings->cod_deadline_hours),
                'seller_eligible_at' => $at->addHours($settings->seller_delay_hours),
                'logistics_eligible_at' => $at->addHours($settings->logistics_delay_hours),
            ]);
            app(RemittanceService::class)->syncInvoice($invoice);

            IssueCodInvoiceDocument::dispatch($invoice->id)->afterCommit();

            return $invoice->refresh();
        }, 3);
    }

    public function cents(mixed $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', (string) $amount, 2), 2, '');

        return (int) $whole * 100 + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }
}
