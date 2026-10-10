<?php

namespace App\Services\Customer\Vouchers;

use App\Models\Shop;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class VoucherCatalogue
{
    public function publicQuery(): Builder
    {
        $query = Voucher::query()->where('lifecycle', 'published')
            ->where(fn ($query) => $query->where('issuer_type', 'app')->orWhereHas('shop', fn ($shop) => $shop->storefrontVisible()));
        foreach (['customer_ids', 'excluded_customer_ids'] as $key) {
            $query->where(fn ($query) => $query->whereNull('eligibility_rules->'.$key)->orWhereJsonLength('eligibility_rules->'.$key, 0));
        }

        return $query;
    }

    public function listing(array $filters, ?Shop $shop = null): LengthAwarePaginator
    {
        $query = $this->publicQuery()->where('ends_at', '>', now());
        if ($shop) {
            $query->where('issuer_type', 'shop')->where('shop_id', $shop->id);
        }

        return $this->paginate($query, $filters);
    }

    public function detail(string $id): Voucher
    {
        return $this->enrich($this->publicQuery())->findOrFail($id);
    }

    public function personalQuery(User $customer): Builder
    {
        return Voucher::query()->where(function ($query) use ($customer) {
            $query->whereHas('claims', fn ($claim) => $claim->where('customer_id', $customer->id))
                ->orWhereHas('redemptions', fn ($redemption) => $redemption->where('customer_id', $customer->id))
                ->orWhere(function ($automatic) use ($customer) {
                    $automatic->where('issuer_type', 'app')->where('distribution_mode', 'automatic')
                        ->where('lifecycle', 'published')->where('ends_at', '>', now());
                    $this->eligibleCustomer($automatic, $customer);
                });
        });
    }

    public function mine(User $customer, array $filters): LengthAwarePaginator
    {
        $query = $this->personalQuery($customer);
        $history = "(lifecycle <> 'published' OR ends_at <= ? OR (global_limit IS NOT NULL AND redeemed_count >= global_limit) OR (SELECT COUNT(*) FROM voucher_redemptions r WHERE r.voucher_id = vouchers.id AND r.customer_id = ?) >= per_customer_limit)";
        $status = $filters['status'] ?? 'available';
        $query->whereRaw(($status === 'history' ? '' : 'NOT ').$history, [now(), $customer->id]);
        if ($status !== 'history') {
            $query->where('starts_at', $status === 'upcoming' ? '>' : '<=', now());
        }

        return $this->paginate($query, $filters, $customer);
    }

    public function statuses(User $customer, array $ids): array
    {
        // Targeted definitions are returned only to eligible Customers or retained owners.
        $query = Voucher::query()->whereIn('id', $ids)->where(function ($query) use ($customer) {
            $query->whereIn('id', $this->personalQuery($customer)->select('vouchers.id'))
                ->orWhere(function ($eligible) use ($customer) {
                    $eligible->where('lifecycle', 'published')
                        ->where(fn ($scope) => $scope->where('issuer_type', 'app')->orWhereHas('shop', fn ($shop) => $shop->storefrontVisible()));
                    $this->eligibleCustomer($eligible, $customer);
                });
        });

        return $this->enrich($query, $customer)->orderBy('ends_at')->orderBy('id')->get()->all();
    }

    public function eligibleCustomer(Builder $query, User $customer): void
    {
        $query->where(fn ($query) => $query->whereNull('eligibility_rules->customer_ids')
            ->orWhereJsonLength('eligibility_rules->customer_ids', 0)->orWhereJsonContains('eligibility_rules->customer_ids', $customer->id))
            ->where(fn ($query) => $query->whereNull('eligibility_rules->excluded_customer_ids')
                ->orWhereJsonDoesntContain('eligibility_rules->excluded_customer_ids', $customer->id));
    }

    public function enrich(Builder $query, ?User $customer = null): Builder
    {
        $query->with('shop:id,name,slug')->withExists(['shop as visible_shop_exists' => fn ($shop) => $shop->storefrontVisible()]);
        if ($customer) {
            $query->with(['claims' => fn ($claim) => $claim->where('customer_id', $customer->id)])
                ->withCount(['redemptions as personal_redemptions_count' => fn ($redemption) => $redemption->where('customer_id', $customer->id)]);
        }

        return $query;
    }

    private function paginate(Builder $query, array $filters, ?User $customer = null): LengthAwarePaginator
    {
        foreach (['issuer' => 'issuer_type', 'benefit' => 'benefit_type'] as $filter => $column) {
            if (isset($filters[$filter])) {
                $query->where($column, $filters[$filter]);
            }
        }

        return $this->enrich($query, $customer)->orderBy('ends_at')->orderBy('id')
            ->paginate((int) ($filters['limit'] ?? 20), ['*'], 'page', (int) ($filters['page'] ?? 1));
    }
}
