<?php

namespace App\Services\Customer;

use App\Enums\Customer\CustomerOrderGroup;
use App\Models\Order;
use App\Models\OrderStatusEvent;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class OrderTrackingService
{
    public function __construct(private readonly CustomerOrderStatusMapper $statuses) {}

    /** @return LengthAwarePaginator<int, Order> */
    public function orders(User $customer, ?CustomerOrderGroup $group, int $perPage): LengthAwarePaginator
    {
        return Order::query()
            ->where('customer_id', $customer->id)
            ->when($group, fn ($query, CustomerOrderGroup $selected) => $query->whereIn(
                'status',
                array_map(fn ($status) => $status->value, $this->statuses->statusesFor($selected)),
            ))
            ->with(['shop:id,name,slug,logo_path', 'items:id,order_id,product_id,product_name,variant_name,quantity'])
            ->withMax('statusEvents as latest_tracking_at', 'occurred_at')
            ->orderByDesc('latest_tracking_at')
            ->orderByDesc('placed_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function order(User $customer, string $orderId): Order
    {
        $order = Order::query()
            ->where('customer_id', $customer->id)
            ->whereKey($orderId)
            ->with([
                'shop:id,name,slug,logo_path',
                'items:id,order_id,product_id,product_variant_id,product_name,variant_name,sku,selected_options,unit_price,quantity,line_subtotal,currency',
                'address',
                'vouchers:id,order_id,voucher_id,code,issuer_type,benefit_type,discount_amount,currency,terms_summary',
                'statusEvents' => fn ($query) => $query
                    ->orderByDesc('occurred_at')
                    ->orderByDesc('id')
                    ->limit(25),
            ])
            ->withCount('statusEvents')
            ->withMax('statusEvents as latest_tracking_at', 'occurred_at')
            ->firstOrFail();

        $order->setRelation('statusEvents', $order->statusEvents
            ->sort(fn (OrderStatusEvent $left, OrderStatusEvent $right) => [
                $left->occurred_at->getTimestamp(),
                $left->id,
            ] <=> [
                $right->occurred_at->getTimestamp(),
                $right->id,
            ])
            ->values());

        return $order;
    }

    /** @return LengthAwarePaginator<int, OrderStatusEvent> */
    public function tracking(User $customer, string $orderId, int $perPage): LengthAwarePaginator
    {
        $order = Order::query()
            ->where('customer_id', $customer->id)
            ->whereKey($orderId)
            ->firstOrFail(['id']);

        return $order->statusEvents()
            ->orderBy('occurred_at')
            ->orderBy('id')
            ->paginate($perPage)
            ->withQueryString();
    }
}
