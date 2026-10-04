<?php

namespace App\Services\Finance\Automation;

use App\Enums\OrderStatus;
use App\Models\CodInvoice;
use App\Models\Order;
use App\Models\ShipmentEvent;

class FinanceBackfillService
{
    public function run(): int
    {
        $created = 0;
        Order::query()->where('status', 'delivered')->where('payment_method', 'cod')
            ->whereNotIn('id', CodInvoice::query()->select('order_id'))->with('statusEvents')->chunkById(100, function ($orders) use (&$created) {
                foreach ($orders as $order) {
                    $event = ShipmentEvent::query()->where('event_type', 'delivery_completed')->whereHas('shipment.parcel', fn ($q) => $q->where('order_id', $order->id))->latest('occurred_at')->first();
                    $collector = $event?->metadata['cod_collector_organization_id'] ?? null;
                    $delivered = $event?->occurred_at ?? $order->statusEvents->where('to_status', OrderStatus::Delivered)->max('occurred_at');
                    if ($delivered) {
                        app(CodInvoiceService::class)->issue($order, $collector, $delivered, $collector ? null : 'Historical collector requires evidence review.');
                        $created++;
                    }
                }
            });

        return $created;
    }
}
