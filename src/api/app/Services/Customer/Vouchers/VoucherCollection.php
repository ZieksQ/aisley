<?php

namespace App\Services\Customer\Vouchers;

use App\Enums\VoucherIssuerType;
use App\Models\Shop;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherClaim;
use Illuminate\Support\Facades\DB;

class VoucherCollection
{
    public function __construct(private VoucherAvailability $availability, private VoucherCatalogue $catalogue) {}

    public function collect(User $customer, string $id, ?Shop $shop = null): Voucher
    {
        return DB::transaction(function () use ($customer, $id, $shop) {
            // Same lock as authoring/redemption, followed by the unique Customer/Voucher insert.
            $voucher = Voucher::query()->whereKey($id)
                ->where('issuer_type', $shop ? VoucherIssuerType::Shop : VoucherIssuerType::App)
                ->when($shop, fn ($query) => $query->where('shop_id', $shop->id))
                ->lockForUpdate()->firstOrFail();
            if ($shop && ! $this->availability->visibleShop($voucher)) {
                abort(404);
            }
            $existing = VoucherClaim::query()->where('customer_id', $customer->id)->where('voucher_id', $id)->first();
            if (! $existing) {
                $reason = $this->availability->reason($voucher, $customer);
                if ($reason !== null) {
                    abort(response()->json(['code' => $reason, 'message' => 'This voucher cannot be collected at the moment.'], 409));
                }
                if ($voucher->requiresClaim()) {
                    VoucherClaim::create(['customer_id' => $customer->id, 'voucher_id' => $id, 'collected_at' => now()]);
                }
            }

            return $this->catalogue->enrich(Voucher::query(), $customer)->findOrFail($id);
        }, 3);
    }
}
