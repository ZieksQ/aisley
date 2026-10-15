<?php

namespace App\Services\Seller;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Shop;
use Carbon\CarbonImmutable;

/** Read-only activity; order value is deliberately not presented as settled revenue. */
class DashboardOrderActivity
{
    public function forShop(Shop $shop, CarbonImmutable $snapshot): array
    {
        $orders = Order::query()->where('shop_id', $shop->id);
        $counts = (clone $orders)->selectRaw('status, COUNT(*) AS aggregate')
            ->groupBy('status')->pluck('aggregate', 'status');
        $endExclusive = $snapshot->startOfDay();
        $start = $endExclusive->subDays(14);
        $daily = (clone $orders)->where('placed_at', '>=', $start)->where('placed_at', '<', $endExclusive)
            ->where('status', '!=', OrderStatus::PendingPayment)
            ->selectRaw('DATE(placed_at) AS day, COUNT(*) AS aggregate')
            ->groupByRaw('DATE(placed_at)')->pluck('aggregate', 'day');
        $trend = [];
        for ($day = $start; $day->lt($endExclusive); $day = $day->addDay()) {
            $date = $day->format('Y-m-d');
            $trend[] = ['date' => $date, 'count' => (int) $daily->get($date, 0)];
        }

        return [
            'state' => $counts->sum() === 0 ? 'empty' : 'available',
            'metrics' => [
                'awaiting_approval' => (int) $counts->get(OrderStatus::Placed->value, 0),
                'processing' => (int) $counts->get(OrderStatus::SellerProcessing->value, 0),
                'ready_for_pickup' => (int) $counts->get(OrderStatus::ReadyForPickup->value, 0),
                'delivered' => (int) $counts->get(OrderStatus::Delivered->value, 0),
            ],
            'by_status' => (object) $counts->map(fn ($count): int => (int) $count)->all(),
            'daily_placed' => $trend,
            'timezone' => 'UTC',
            'from' => $start->format('Y-m-d'),
            'to' => $endExclusive->subDay()->format('Y-m-d'),
        ];
    }
}
