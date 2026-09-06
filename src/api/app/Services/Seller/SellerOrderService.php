<?php

namespace App\Services\Seller;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SellerOrderService
{
    public function __construct(private readonly SellerShopService $shops) {}

    /** @return LengthAwarePaginator<int, Order> */
    public function list(User $seller, array $filters): LengthAwarePaginator
    {
        $shop = $this->shops->for($seller);
        $orders = Order::query()
            ->where('shop_id', $shop->id)
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['notification'] ?? null, function ($query, string $state) use ($seller): void {
                $jsonOrderId = $this->notificationOrderIdSql();
                $query->whereExists(function ($notifications) use ($seller, $state, $jsonOrderId): void {
                    $notifications->selectRaw('1')
                        ->from('notifications')
                        ->where('notifications.notifiable_type', User::class)
                        ->where('notifications.notifiable_id', $seller->id)
                        ->where('notifications.type', 'seller-order.actionable')
                        ->whereRaw("{$jsonOrderId} = orders.id")
                        ->when($state === 'unread', fn ($query) => $query->whereNull('notifications.read_at'))
                        ->when($state === 'read', fn ($query) => $query->whereNotNull('notifications.read_at'));
                });
            })
            ->with($this->relations())
            ->withMax('statusEvents as latest_activity_at', 'occurred_at')
            ->orderByDesc('latest_activity_at')
            ->orderByDesc('placed_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 20))
            ->withQueryString();

        $this->decorate($seller, $orders->getCollection());

        return $orders;
    }

    public function detail(User $seller, string $orderId): Order
    {
        $shop = $this->shops->for($seller);
        $order = Order::query()
            ->where('shop_id', $shop->id)
            ->whereKey($orderId)
            ->with($this->relations())
            ->withCount('statusEvents')
            ->withMax('statusEvents as latest_activity_at', 'occurred_at')
            ->first();
        if ($order === null) {
            throw (new ModelNotFoundException)->setModel(Order::class, [$orderId]);
        }

        $this->decorate($seller, collect([$order]));

        return $order;
    }

    /** @return array<string, mixed> */
    private function relations(): array
    {
        return [
            'items:id,order_id,product_id,product_variant_id,product_name,variant_name,sku,selected_options,unit_price,quantity,line_subtotal,currency',
            'address',
            'statusEvents' => fn ($query) => $query->orderBy('occurred_at')->orderBy('id'),
        ];
    }

    /** @param Collection<int, Order> $orders */
    private function decorate(User $seller, Collection $orders): void
    {
        if ($orders->isEmpty()) {
            return;
        }
        $notifications = $seller->notifications()
            ->where('type', 'seller-order.actionable')
            ->whereRaw(
                $this->notificationOrderIdSql().' IN ('.implode(', ', array_fill(0, $orders->count(), '?')).')',
                $orders->pluck('id')->all(),
            )
            ->get()
            ->keyBy(fn ($notification) => (string) ($notification->data['order_id'] ?? ''));

        foreach ($orders as $order) {
            $notification = $notifications->get($order->id);
            $order->setAttribute('seller_notification_id', $notification?->id);
            $order->setAttribute('seller_notification_read_at', $notification?->read_at);
            $order->setAttribute('seller_can_accept', $this->canAccept($order));
            $order->setAttribute('seller_can_prepare', $order->status === OrderStatus::SellerProcessing);
            $order->setAttribute('seller_can_view_waybill', false);
        }
    }

    private function canAccept(Order $order): bool
    {
        return $order->status === OrderStatus::Placed
            && $order->payment_method === PaymentMethod::CashOnDelivery
            && $order->payment_status === PaymentStatus::Pending
            && $order->items->isNotEmpty()
            && $order->address !== null;
    }

    private function notificationOrderIdSql(): string
    {
        return match (DB::getDriverName()) {
            'pgsql' => "(notifications.data::jsonb ->> 'order_id')",
            'sqlite' => "json_extract(notifications.data, '$.order_id')",
            default => "JSON_UNQUOTE(JSON_EXTRACT(notifications.data, '$.order_id'))",
        };
    }
}
