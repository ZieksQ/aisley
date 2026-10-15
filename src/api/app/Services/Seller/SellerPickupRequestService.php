<?php

namespace App\Services\Seller;

use App\Models\SellerPickupRequest;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class SellerPickupRequestService
{
    public function __construct(private readonly SellerShopService $shops) {}

    /** @param array<string, mixed> $filters
     *  @return LengthAwarePaginator<int, SellerPickupRequest>
     */
    public function list(User $seller, array $filters): LengthAwarePaginator
    {
        $shop = $this->shops->for($seller);
        $sort = $filters['sort'] ?? 'requested_desc';

        return SellerPickupRequest::query()
            ->where('seller_id', $seller->id)
            ->where('shop_id', $shop->id)
            ->with('organization:id,business_name')
            ->withCount('orders as orders_count')
            ->when($sort === 'requested_desc', fn ($query) => $query->orderByDesc('created_at'))
            ->when($sort === 'requested_asc', fn ($query) => $query->orderBy('created_at'))
            ->when($sort === 'orders_desc', fn ($query) => $query->orderByDesc('orders_count'))
            ->when($sort === 'orders_asc', fn ($query) => $query->orderBy('orders_count'))
            ->when($sort === 'status', fn ($query) => $query->orderBy('status')->orderByDesc('created_at'))
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 20))
            ->withQueryString();
    }

    public function find(User $seller, string $pickupId): SellerPickupRequest
    {
        $shop = $this->shops->for($seller);

        return SellerPickupRequest::query()
            ->where('seller_id', $seller->id)
            ->where('shop_id', $shop->id)
            ->with('organization:id,business_name')
            ->withCount('orders as orders_count')
            ->whereKey($pickupId)
            ->firstOrFail();
    }
}
