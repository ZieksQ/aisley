<?php

namespace App\Services\Seller;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class OrderPickingSheetService
{
    public function __construct(private readonly SellerShopService $shops) {}

    /** @param list<string> $orderIds */
    public function response(User $seller, array $orderIds): Response
    {
        $shop = $this->shops->for($seller);
        $orderIds = array_map('strtolower', $orderIds);
        $records = $shop->orders()->whereKey($orderIds)
            ->with(['address', 'items' => fn ($query) => $query->orderBy('id')])
            ->get()->keyBy('id');

        // Reject the whole read if any selected Order is missing or belongs to another Shop.
        abort_if($records->count() !== count($orderIds), 404, 'One or more selected orders are unavailable. Refresh the orders and select again.');

        $orders = collect($orderIds)->map(function (string $id) use ($records): array {
            /** @var Order $order */
            $order = $records->get($id);

            return [
                'reference' => $order->reference,
                'customer' => $order->address?->recipient_name ?? 'Customer snapshot unavailable',
                'destination' => $order->address === null ? null : implode(', ', array_filter([
                    $order->address->city_municipality, $order->address->province,
                ])),
                'placed_at' => $order->placed_at->timezone('Asia/Manila')->format('M j, Y g:i A'),
                'status' => match ($order->status) {
                    OrderStatus::Placed => 'Awaiting approval',
                    OrderStatus::SellerProcessing => 'Processing',
                    OrderStatus::Assigned => 'Received by Logistics',
                    default => Str::headline($order->status->value),
                },
                'items' => $order->items->map(fn ($item): array => [
                    'name' => $item->product_name,
                    'variant' => $item->variant_name,
                    'options' => collect($item->selected_options ?? [])->map(fn ($option) => $option['group'].': '.$option['value'])->implode(', '),
                    'sku' => $item->sku ?? 'Unavailable',
                    'quantity' => $item->quantity,
                ])->all(),
            ];
        });
        $generatedAt = now()->timezone('Asia/Manila');
        $pdf = Pdf::setOptions([
            'isRemoteEnabled' => false,
            'isPhpEnabled' => false,
            'isJavascriptEnabled' => false,
            'isFontSubsettingEnabled' => true,
            'defaultFont' => 'DejaVu Sans',
            'chroot' => resource_path('views/seller'),
        ])->loadView('seller.orders.picking-sheet', [
            'shopName' => $shop->name,
            'orders' => $orders,
            'generatedAt' => $generatedAt->format('M j, Y g:i A').' (Asia/Manila)',
            'quantity' => $orders->sum(fn ($order) => collect($order['items'])->sum('quantity')),
        ])->setPaper('a4');

        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="order-picking-sheet-'.$generatedAt->format('Y-m-d-His').'.pdf"',
            'Cache-Control' => 'private, no-store, max-age=0',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
