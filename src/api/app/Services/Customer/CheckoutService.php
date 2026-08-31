<?php

namespace App\Services\Customer;

use App\Enums\AddressType;
use App\Enums\CheckoutMode;
use App\Enums\InventoryMovementType;
use App\Enums\InventorySkuStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\ProductVariantStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\VoucherBenefitType;
use App\Enums\VoucherIssuerType;
use App\Enums\VoucherValueType;
use App\Exceptions\Customer\CheckoutException;
use App\Models\Address;
use App\Models\CartItem;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherRedemption;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CheckoutService
{
    /** @param array<string, mixed> $data */
    public function quote(User $customer, array $data): array
    {
        $input = $this->normalizedInput($data);
        $calculation = $this->calculate($customer, $input, false);
        $quote = CheckoutQuote::create([
            'customer_id' => $customer->id,
            'input_payload' => $input,
            'request_hash' => $this->hash($input),
            'state_hash' => $calculation['state_hash'],
            'expires_at' => now()->addMinutes(max(1, (int) config('checkout.quote_ttl_minutes', 15))),
        ]);

        return [
            'quoteId' => $quote->id,
            'expiresAt' => $quote->expires_at->toISOString(),
            'mode' => $input['mode'],
            'paymentMethod' => PaymentMethod::CashOnDelivery->value,
            'address' => $this->addressPayload($calculation['address']),
            'groups' => $this->groupPayloads($calculation['groups']),
            'summary' => $this->summaryPayload($calculation['groups']),
        ];
    }

    /** @param array<string, mixed> $data */
    public function place(User $customer, array $data, string $idempotencyKey): CheckoutBatch
    {
        $input = $this->normalizedInput(Arr::except($data, ['quote_id']));
        $placementHash = $this->hash(['quote_id' => $data['quote_id'], 'input' => $input]);

        $existing = CheckoutBatch::query()
            ->where('customer_id', $customer->id)
            ->where('idempotency_key', $idempotencyKey)
            ->first();
        if ($existing !== null) {
            return $this->idempotentResult($existing, $placementHash);
        }

        return DB::transaction(function () use ($customer, $data, $input, $idempotencyKey, $placementHash): CheckoutBatch {
            User::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();

            $existing = CheckoutBatch::query()
                ->where('customer_id', $customer->id)
                ->where('idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($existing !== null) {
                return $this->idempotentResult($existing, $placementHash);
            }

            $quote = CheckoutQuote::query()
                ->where('customer_id', $customer->id)
                ->whereKey($data['quote_id'])
                ->lockForUpdate()
                ->first();
            if ($quote === null) {
                throw CheckoutException::invalid('QUOTE_NOT_FOUND', 'The checkout quote does not exist.', 'quote_id');
            }
            if ($quote->batch()->exists()) {
                throw CheckoutException::conflict('QUOTE_ALREADY_PLACED', 'This checkout quote has already been placed.', 'quote_id');
            }
            if ($quote->expires_at->isPast()) {
                throw CheckoutException::conflict('QUOTE_EXPIRED', 'The checkout quote has expired. Request a new quote.', 'quote_id');
            }
            if ($quote->request_hash !== $this->hash($input)) {
                throw CheckoutException::conflict('QUOTE_INPUT_CHANGED', 'Checkout details changed. Request a new quote.', 'quote_id');
            }

            $calculation = $this->calculate($customer, $input, true);
            if (! hash_equals($quote->state_hash, $calculation['state_hash'])) {
                throw CheckoutException::conflict('QUOTE_STALE', 'Price, stock, address, shipping, or voucher details changed. Request a new quote.', 'quote_id');
            }

            $placedAt = now();
            $batch = CheckoutBatch::create([
                'customer_id' => $customer->id,
                'checkout_quote_id' => $quote->id,
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $placementHash,
                'currency' => config('checkout.currency', 'PHP'),
                'placed_at' => $placedAt,
            ]);

            foreach ($calculation['groups'] as $group) {
                $order = $this->createOrder($batch, $customer, $calculation['address'], $group, $placedAt);
                $this->reserveInventory($batch, $order, $group['lines']);
                $this->redeemVouchers($batch, $customer, $order, $group['applied_vouchers'], $placedAt);
            }

            if ($input['mode'] === CheckoutMode::Cart->value) {
                CartItem::query()
                    ->whereIn('id', $input['cart_item_ids'])
                    ->whereHas('cart', fn ($query) => $query->where('customer_id', $customer->id))
                    ->delete();
            }

            return $this->loadBatch($batch);
        }, 3);
    }

    public function batch(User $customer, string $batchId): CheckoutBatch
    {
        $batch = CheckoutBatch::query()
            ->where('customer_id', $customer->id)
            ->find($batchId);

        if ($batch === null) {
            throw (new ModelNotFoundException)->setModel(CheckoutBatch::class, [$batchId]);
        }

        return $this->loadBatch($batch);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function normalizedInput(array $data): array
    {
        $vouchers = collect($data['vouchers'] ?? [])->map(fn (array $selection) => [
            'voucher_id' => strtolower($selection['voucher_id']),
            'target_shop_id' => strtolower($selection['target_shop_id']),
        ])->sortBy(['target_shop_id', 'voucher_id'])->values()->all();

        $input = [
            'mode' => $data['mode'],
            'address_id' => strtolower($data['address_id']),
            'payment_method' => $data['payment_method'],
            'vouchers' => $vouchers,
        ];
        if ($data['mode'] === CheckoutMode::Cart->value) {
            $input['cart_item_ids'] = collect($data['cart_item_ids'])->map('strtolower')->sort()->values()->all();
        } else {
            $input['buy_now'] = [
                'product_id' => strtolower($data['buy_now']['product_id']),
                'variant_id' => isset($data['buy_now']['variant_id']) ? strtolower($data['buy_now']['variant_id']) : null,
                'quantity' => (int) $data['buy_now']['quantity'],
            ];
        }

        return $input;
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    private function calculate(User $customer, array $input, bool $lock): array
    {
        $addressQuery = Address::query()->where('user_id', $customer->id)->whereKey($input['address_id']);
        $address = ($lock ? $addressQuery->lockForUpdate() : $addressQuery)->first();
        if ($address === null) {
            throw CheckoutException::invalid('ADDRESS_NOT_FOUND', 'Select an address from your Address Book.', 'address_id');
        }
        if ($address->type === AddressType::Billing) {
            throw CheckoutException::invalid('ADDRESS_NOT_SHIPPING', 'The selected address is not available for shipping.', 'address_id');
        }
        $this->assertCompleteAddress($address);

        $lineIntents = $this->lineIntents($customer, $input, $lock);
        $productIds = collect($lineIntents)->pluck('product_id')->unique()->sort()->values()->all();
        $variantIds = collect($lineIntents)->pluck('variant_id')->filter()->unique()->sort()->values()->all();

        $productQuery = Product::query()->whereIn('id', $productIds)->orderBy('id');
        if ($lock) {
            $productQuery->lockForUpdate();
        }
        $products = $productQuery->with(['shop.seller', 'optionGroups', 'activeComplianceRestriction'])->get()->keyBy('id');

        $variantQuery = ProductVariant::query()->whereIn('id', $variantIds)->orderBy('id');
        if ($lock) {
            $variantQuery->lockForUpdate();
        }
        $variants = $variantQuery->with('optionValues.optionGroup')->get()->keyBy('id');

        $skuRows = InventorySku::query()
            ->where(function ($query) use ($productIds, $variantIds) {
                $query->where(fn ($base) => $base->whereIn('product_id', $productIds)->where('is_base', true));
                if ($variantIds !== []) {
                    $query->orWhereIn('product_variant_id', $variantIds);
                }
            })
            ->orderBy('id')->get();
        $skuByTarget = $skuRows->keyBy(fn (InventorySku $sku) => $sku->product_variant_id ?? $sku->product_id);
        $balanceQuery = InventoryBalance::query()->whereIn('inventory_sku_id', $skuRows->pluck('id'))->orderBy('inventory_sku_id');
        if ($lock) {
            $balanceQuery->lockForUpdate();
        }
        $balances = $balanceQuery->get()->keyBy('inventory_sku_id');

        $groups = [];
        $state = ['address' => [$address->id, $address->updated_at?->getTimestamp()], 'shipping' => (string) config('checkout.shipping_fee_per_shop', '0.00'), 'lines' => [], 'vouchers' => []];
        foreach ($lineIntents as $intent) {
            /** @var Product|null $product */
            $product = $products->get($intent['product_id']);
            $variant = $intent['variant_id'] === null ? null : $variants->get($intent['variant_id']);
            $this->assertPurchasable($product, $variant, $intent['quantity']);
            $sku = $skuByTarget->get($variant?->id ?? $product->id);
            $balance = $sku === null ? null : $balances->get($sku->id);
            if ($sku === null || $balance === null || $sku->status !== InventorySkuStatus::Active) {
                throw CheckoutException::conflict('INVENTORY_UNAVAILABLE', 'Inventory is unavailable for a selected item.', $intent['field']);
            }
            if ($intent['quantity'] > $balance->available()) {
                throw CheckoutException::conflict(
                    $balance->available() < 1 ? 'OUT_OF_STOCK' : 'INSUFFICIENT_STOCK',
                    $balance->available() < 1 ? 'A selected item is out of stock.' : "Only {$balance->available()} item(s) are currently available.",
                    $intent['field'],
                );
            }

            $unitCents = $this->cents($variant?->price ?? $product->price);
            $options = $variant === null ? [] : $variant->optionValues
                ->sortBy(fn ($value) => sprintf('%010d-%010d', $value->optionGroup->position, $value->position))
                ->map(fn ($value) => ['group' => $value->optionGroup->name, 'value' => $value->value])->values()->all();
            $line = [
                'source_cart_item_id' => $intent['cart_item_id'], 'product' => $product, 'variant' => $variant,
                'sku' => $sku, 'balance' => $balance, 'quantity' => $intent['quantity'], 'unit_cents' => $unitCents,
                'subtotal_cents' => $unitCents * $intent['quantity'], 'options' => $options,
            ];
            $groups[$product->shop_id] ??= [
                'shop' => $product->shop, 'lines' => [], 'subtotal_cents' => 0,
                'shipping_cents' => $this->cents(config('checkout.shipping_fee_per_shop', '0.00')),
                'available_vouchers' => [], 'applied_vouchers' => [],
            ];
            $groups[$product->shop_id]['lines'][] = $line;
            $groups[$product->shop_id]['subtotal_cents'] += $line['subtotal_cents'];
            $state['lines'][] = [$product->id, $product->updated_at?->getTimestamp(), $variant?->id, $variant?->updated_at?->getTimestamp(), $sku->id, $balance->on_hand, $balance->reserved, $intent['quantity'], $unitCents];
        }
        ksort($groups);

        $this->applyVouchers($customer, $groups, $input['vouchers'], $lock, $state);
        foreach ($groups as &$group) {
            $group['discount_cents'] = collect($group['applied_vouchers'])->where('benefit_type', VoucherBenefitType::Discount)->sum('discount_cents');
            $group['shipping_discount_cents'] = collect($group['applied_vouchers'])->where('benefit_type', VoucherBenefitType::Shipping)->sum('discount_cents');
            $group['payable_cents'] = max(0, $group['subtotal_cents'] - $group['discount_cents'] + $group['shipping_cents'] - $group['shipping_discount_cents']);
        }
        unset($group);

        sort($state['lines']);
        sort($state['vouchers']);

        return ['address' => $address, 'groups' => $groups, 'state_hash' => $this->hash($state)];
    }

    /** @param array<string, mixed> $input @return list<array<string, mixed>> */
    private function lineIntents(User $customer, array $input, bool $lock): array
    {
        if ($input['mode'] === CheckoutMode::BuyNow->value) {
            return [[
                'cart_item_id' => null,
                'product_id' => $input['buy_now']['product_id'],
                'variant_id' => $input['buy_now']['variant_id'],
                'quantity' => $input['buy_now']['quantity'],
                'field' => 'buy_now',
            ]];
        }

        $query = CartItem::query()
            ->whereIn('id', $input['cart_item_ids'])
            ->whereHas('cart', fn ($cart) => $cart->where('customer_id', $customer->id))
            ->orderBy('id');
        if ($lock) {
            $query->lockForUpdate();
        }
        $items = $query->get();
        if ($items->count() !== count($input['cart_item_ids'])) {
            throw CheckoutException::invalid('CART_ITEM_NOT_FOUND', 'One or more Cart items do not belong to this Customer.', 'cart_item_ids');
        }

        return $items->map(fn (CartItem $item) => [
            'cart_item_id' => $item->id, 'product_id' => $item->product_id, 'variant_id' => $item->variant_id,
            'quantity' => $item->quantity, 'field' => 'cart_item_ids',
        ])->all();
    }

    private function assertPurchasable(?Product $product, ?ProductVariant $variant, int $quantity): void
    {
        if ($product === null) {
            throw CheckoutException::invalid('PRODUCT_NOT_FOUND', 'A selected product does not exist.', 'product_id');
        }
        $visible = $product->status === ProductStatus::Active
            && $product->published_at !== null && ! $product->published_at->isFuture()
            && $product->shop?->status === ShopStatus::Active && ! $product->shop->is_on_vacation
            && $product->shop->seller?->role === UserRole::Seller && $product->shop->seller?->status === UserStatus::Active
            && ! $product->isComplianceRestricted();
        if (! $visible) {
            throw CheckoutException::conflict('PRODUCT_UNAVAILABLE', 'A selected product is no longer available.', 'product_id');
        }

        $groups = $product->optionGroups->pluck('id')->sort()->values();
        if ($groups->isEmpty() && $variant !== null) {
            throw CheckoutException::invalid('VARIANT_NOT_ALLOWED', 'A selected product does not accept a variation.', 'variant_id');
        }
        if ($groups->isNotEmpty() && $variant === null) {
            throw CheckoutException::invalid('VARIANT_REQUIRED', 'Select a complete product variation.', 'variant_id');
        }
        if ($variant !== null) {
            $actual = $variant->optionValues->pluck('option_group_id')->sort()->values();
            if ($variant->product_id !== $product->id || $variant->status !== ProductVariantStatus::Active
                || $actual->unique()->count() !== $groups->count() || $actual->all() !== $groups->all()) {
                throw CheckoutException::conflict('VARIANT_UNAVAILABLE', 'A selected variation is no longer available.', 'variant_id');
            }
        }
        if ($quantity < 1) {
            throw CheckoutException::invalid('INVALID_QUANTITY', 'Quantity must be at least one.', 'quantity');
        }
    }

    /** @param array<string, array<string, mixed>> $groups @param list<array<string, string>> $selections @param array<string, mixed> $state */
    private function applyVouchers(User $customer, array &$groups, array $selections, bool $lock, array &$state): void
    {
        $voucherQuery = Voucher::query()
            ->where(function ($query) use ($groups) {
                $query->where('issuer_type', VoucherIssuerType::App->value)
                    ->orWhereIn('shop_id', array_keys($groups));
            })->orderBy('id');
        if ($lock) {
            $voucherQuery->whereIn('id', collect($selections)->pluck('voucher_id'));
            $voucherQuery->lockForUpdate();
        }
        $vouchers = $voucherQuery->get()->keyBy('id');
        $appCount = 0;

        foreach ($groups as $shopId => &$group) {
            foreach ($vouchers as $voucher) {
                if ($voucher->issuer_type === VoucherIssuerType::Shop && $voucher->shop_id !== $shopId) {
                    continue;
                }
                $reason = $this->voucherIneligibility($voucher, $customer, $group);
                $group['available_vouchers'][] = $this->voucherPayload($voucher, $group, $reason);
            }
        }
        unset($group);

        foreach ($selections as $index => $selection) {
            /** @var Voucher|null $voucher */
            $voucher = $vouchers->get($selection['voucher_id']);
            $group = $groups[$selection['target_shop_id']] ?? null;
            if ($voucher === null || $group === null) {
                throw CheckoutException::invalid('VOUCHER_TARGET_INVALID', 'The selected voucher target is invalid.', "vouchers.{$index}.target_shop_id");
            }
            if ($voucher->issuer_type === VoucherIssuerType::Shop && $voucher->shop_id !== $selection['target_shop_id']) {
                throw CheckoutException::invalid('VOUCHER_SHOP_MISMATCH', 'A Shop voucher can only apply to its issuing Shop.', "vouchers.{$index}.voucher_id");
            }
            if ($voucher->issuer_type === VoucherIssuerType::App && ++$appCount > 1) {
                throw CheckoutException::invalid('APP_VOUCHER_LIMIT', 'Only one App voucher may be used per checkout batch.', 'vouchers');
            }
            $reason = $this->voucherIneligibility($voucher, $customer, $group);
            if ($reason !== null) {
                throw CheckoutException::conflict($reason, 'A selected voucher is no longer eligible.', "vouchers.{$index}.voucher_id");
            }
            if (collect($groups[$selection['target_shop_id']]['applied_vouchers'])->contains('benefit_type', $voucher->benefit_type)) {
                throw CheckoutException::invalid('VOUCHER_BENEFIT_LIMIT', 'Only one voucher of each benefit type may apply to a Shop order.', 'vouchers');
            }
            foreach ($groups[$selection['target_shop_id']]['applied_vouchers'] as $applied) {
                if (! $this->canStack($voucher, $applied['voucher']) || ! $this->canStack($applied['voucher'], $voucher)) {
                    throw CheckoutException::invalid('VOUCHERS_NOT_STACKABLE', 'The selected vouchers cannot be combined.', 'vouchers');
                }
            }

            $basis = $voucher->benefit_type === VoucherBenefitType::Shipping
                ? $group['shipping_cents'] : $this->eligibleMerchandiseBasis($voucher, $group['lines']);
            $discount = $this->voucherSaving($voucher, $basis);
            $groups[$selection['target_shop_id']]['applied_vouchers'][] = [
                'voucher' => $voucher, 'benefit_type' => $voucher->benefit_type,
                'basis_cents' => $basis, 'discount_cents' => $discount,
            ];
            $state['vouchers'][] = [$voucher->id, $voucher->updated_at?->getTimestamp(), $voucher->redeemed_count, $selection['target_shop_id'], $basis, $discount];
        }
    }

    /** @param array<string, mixed> $group */
    private function voucherIneligibility(Voucher $voucher, User $customer, array $group): ?string
    {
        if ($voucher->per_customer_limit < 1
            || ! $this->isNonnegativeMoney($voucher->value)
            || ! $this->isNonnegativeMoney($voucher->minimum_spend)
            || ($voucher->maximum_discount !== null && ! $this->isNonnegativeMoney($voucher->maximum_discount))
            || ($voucher->value_type === VoucherValueType::Percent && $this->percentageBasisPoints($voucher->value) > 10000)
            || $voucher->ends_at->lte($voucher->starts_at)) {
            return 'VOUCHER_TERMS_INVALID';
        }
        if (! $voucher->is_active) {
            return 'VOUCHER_INACTIVE';
        }
        if (now()->lt($voucher->starts_at)) {
            return 'VOUCHER_NOT_STARTED';
        }
        if (now()->gte($voucher->ends_at)) {
            return 'VOUCHER_EXPIRED';
        }
        if ($voucher->payment_method !== null && $voucher->payment_method !== PaymentMethod::CashOnDelivery) {
            return 'VOUCHER_PAYMENT_INELIGIBLE';
        }
        if ($voucher->global_limit !== null && $voucher->redeemed_count >= $voucher->global_limit) {
            return 'VOUCHER_EXHAUSTED';
        }
        if (VoucherRedemption::query()->where('voucher_id', $voucher->id)->where('customer_id', $customer->id)->count() >= $voucher->per_customer_limit) {
            return 'VOUCHER_CUSTOMER_LIMIT';
        }
        if ($group['subtotal_cents'] < $this->cents($voucher->minimum_spend)) {
            return 'VOUCHER_MINIMUM_SPEND';
        }

        $rules = $voucher->eligibility_rules ?? [];
        if (($rules['customer_ids'] ?? []) !== [] && ! in_array($customer->id, $rules['customer_ids'], true)) {
            return 'VOUCHER_CUSTOMER_INELIGIBLE';
        }
        if (in_array($customer->id, $rules['excluded_customer_ids'] ?? [], true)) {
            return 'VOUCHER_CUSTOMER_INELIGIBLE';
        }
        if ($this->eligibleMerchandiseBasis($voucher, $group['lines']) < 1) {
            return 'VOUCHER_ITEMS_INELIGIBLE';
        }

        return null;
    }

    /** @param list<array<string, mixed>> $lines */
    private function eligibleMerchandiseBasis(Voucher $voucher, array $lines): int
    {
        $rules = $voucher->eligibility_rules ?? [];

        return collect($lines)->filter(function (array $line) use ($rules): bool {
            $productId = $line['product']->id;
            $categoryId = $line['product']->category_id;
            if (in_array($productId, $rules['excluded_product_ids'] ?? [], true) || in_array($categoryId, $rules['excluded_category_ids'] ?? [], true)) {
                return false;
            }
            if (($rules['product_ids'] ?? []) !== [] && ! in_array($productId, $rules['product_ids'], true)) {
                return false;
            }
            if (($rules['category_ids'] ?? []) !== [] && ! in_array($categoryId, $rules['category_ids'], true)) {
                return false;
            }

            return true;
        })->sum('subtotal_cents');
    }

    private function voucherSaving(Voucher $voucher, int $basis): int
    {
        $saving = $voucher->value_type === VoucherValueType::Fixed
            ? $this->cents($voucher->value)
            : intdiv($basis * $this->percentageBasisPoints($voucher->value) + 5000, 10000);
        if ($voucher->maximum_discount !== null) {
            $saving = min($saving, $this->cents($voucher->maximum_discount));
        }

        return max(0, min($saving, $basis));
    }

    private function canStack(Voucher $voucher, Voucher $other): bool
    {
        return in_array($other->issuer_type->value.':'.$other->benefit_type->value, $voucher->stacking_policy['allow_with'] ?? [], true);
    }

    /** @param array<string, mixed> $group */
    private function voucherPayload(Voucher $voucher, array $group, ?string $reason): array
    {
        $basis = $voucher->benefit_type === VoucherBenefitType::Shipping ? $group['shipping_cents'] : $this->eligibleMerchandiseBasis($voucher, $group['lines']);
        $rules = $voucher->eligibility_rules ?? [];

        return [
            'id' => $voucher->id, 'code' => $voucher->code, 'issuerType' => $voucher->issuer_type->value,
            'benefitType' => $voucher->benefit_type->value, 'valueType' => $voucher->value_type->value,
            'value' => $voucher->value, 'maximumDiscount' => $voucher->maximum_discount,
            'minimumSpend' => $voucher->minimum_spend, 'termsSummary' => $voucher->terms_summary,
            'validFrom' => $voucher->starts_at->toISOString(), 'validUntil' => $voucher->ends_at->toISOString(),
            'paymentMethod' => $voucher->payment_method?->value,
            'stackableWith' => array_values(array_filter((array) ($voucher->stacking_policy['allow_with'] ?? []), 'is_string')),
            'scope' => [
                'productIds' => array_values((array) ($rules['product_ids'] ?? [])),
                'categoryIds' => array_values((array) ($rules['category_ids'] ?? [])),
                'excludedProductIds' => array_values((array) ($rules['excluded_product_ids'] ?? [])),
                'excludedCategoryIds' => array_values((array) ($rules['excluded_category_ids'] ?? [])),
            ],
            'eligible' => $reason === null, 'reason' => $reason,
            'saving' => $reason === null ? $this->money($this->voucherSaving($voucher, $basis)) : '0.00',
        ];
    }

    /** @param array<string, mixed> $group */
    private function createOrder(CheckoutBatch $batch, User $customer, Address $address, array $group, mixed $placedAt): Order
    {
        $order = Order::create([
            'checkout_batch_id' => $batch->id, 'customer_id' => $customer->id, 'shop_id' => $group['shop']->id,
            'reference' => 'ASL-'.now()->format('Ymd').'-'.Str::upper(Str::random(10)),
            'status' => OrderStatus::Placed, 'payment_method' => PaymentMethod::CashOnDelivery,
            'payment_status' => PaymentStatus::Pending, 'currency' => $batch->currency,
            'merchandise_subtotal' => $this->money($group['subtotal_cents']), 'shipping_fee' => $this->money($group['shipping_cents']),
            'discount_total' => $this->money($group['discount_cents']), 'shipping_discount_total' => $this->money($group['shipping_discount_cents']),
            'payable_total' => $this->money($group['payable_cents']), 'placed_at' => $placedAt,
        ]);
        foreach ($group['lines'] as $line) {
            $order->items()->create([
                'product_id' => $line['product']->id, 'product_variant_id' => $line['variant']?->id,
                'product_name' => $line['product']->name,
                'variant_name' => $line['options'] === [] ? null : collect($line['options'])->map(fn ($option) => $option['group'].': '.$option['value'])->join(', '),
                'sku' => $line['variant']?->sku ?? $line['sku']->code, 'selected_options' => $line['options'],
                'unit_price' => $this->money($line['unit_cents']), 'quantity' => $line['quantity'],
                'line_subtotal' => $this->money($line['subtotal_cents']), 'currency' => $batch->currency,
            ]);
        }
        $order->address()->create([
            'source_address_id' => $address->id, 'recipient_name' => $address->recipient_name,
            'contact_number' => $address->contact_number, 'address_line_1' => $address->address_line_1,
            'address_line_2' => $address->address_line_2, 'barangay' => $address->barangay,
            'city_municipality' => $address->city_municipality, 'province' => $address->province,
            'region' => $address->region, 'postal_code' => $address->postal_code, 'country' => $address->country,
            'latitude' => $address->latitude, 'longitude' => $address->longitude,
        ]);
        $order->statusEvents()->create(['from_status' => null, 'to_status' => OrderStatus::Placed, 'source' => 'customer_checkout', 'occurred_at' => $placedAt]);

        return $order;
    }

    /** @param list<array<string, mixed>> $lines */
    private function reserveInventory(CheckoutBatch $batch, Order $order, array $lines): void
    {
        foreach ($lines as $line) {
            /** @var InventoryBalance $balance */
            $balance = $line['balance'];
            $nextReserved = $balance->reserved + $line['quantity'];
            $balance->update(['reserved' => $nextReserved]);
            InventoryMovement::create([
                'inventory_balance_id' => $balance->id, 'movement_type' => InventoryMovementType::Reserve,
                'on_hand_delta' => 0, 'reserved_delta' => $line['quantity'], 'resulting_on_hand' => $balance->on_hand,
                'resulting_reserved' => $nextReserved, 'reference_type' => 'order', 'reference_id' => $order->id,
                'idempotency_key' => 'checkout-'.$batch->id.'-'.$line['sku']->id, 'actor_id' => null,
                'reason' => 'Reserved by Customer checkout placement.',
            ]);
            $available = $balance->on_hand - $nextReserved;
            if ($line['sku']->is_base) {
                $line['product']->update(['stock_quantity' => $available]);
            } else {
                $line['variant']->update(['stock_quantity' => $available]);
                $line['product']->update(['stock_quantity' => (int) $line['product']->variants()->sum('stock_quantity')]);
            }
        }
    }

    /** @param list<array<string, mixed>> $applied */
    private function redeemVouchers(CheckoutBatch $batch, User $customer, Order $order, array $applied, mixed $redeemedAt): void
    {
        foreach ($applied as $entry) {
            /** @var Voucher $voucher */
            $voucher = $entry['voucher'];
            $order->vouchers()->create([
                'voucher_id' => $voucher->id, 'code' => $voucher->code, 'issuer_type' => $voucher->issuer_type,
                'benefit_type' => $voucher->benefit_type, 'qualifying_basis' => $this->money($entry['basis_cents']),
                'discount_amount' => $this->money($entry['discount_cents']), 'currency' => $batch->currency,
                'rule_version' => $voucher->version, 'terms_summary' => $voucher->terms_summary, 'redeemed_at' => $redeemedAt,
            ]);
            VoucherRedemption::create([
                'voucher_id' => $voucher->id, 'customer_id' => $customer->id, 'order_id' => $order->id,
                'checkout_batch_id' => $batch->id, 'discount_amount' => $this->money($entry['discount_cents']),
                'currency' => $batch->currency, 'redeemed_at' => $redeemedAt,
            ]);
            $voucher->increment('redeemed_count');
        }
    }

    /** @param array<string, array<string, mixed>> $groups @return list<array<string, mixed>> */
    private function groupPayloads(array $groups): array
    {
        return collect($groups)->map(fn (array $group) => [
            'shop' => ['id' => $group['shop']->id, 'name' => $group['shop']->name],
            'items' => collect($group['lines'])->map(fn (array $line) => [
                'cartItemId' => $line['source_cart_item_id'], 'productId' => $line['product']->id,
                'variantId' => $line['variant']?->id, 'productName' => $line['product']->name,
                'sku' => $line['variant']?->sku ?? $line['sku']->code, 'selectedOptions' => $line['options'],
                'unitPrice' => $this->money($line['unit_cents']), 'quantity' => $line['quantity'],
                'lineSubtotal' => $this->money($line['subtotal_cents']),
            ])->values(),
            'availableVouchers' => $group['available_vouchers'],
            'appliedVouchers' => collect($group['applied_vouchers'])->map(fn (array $entry) => [
                'id' => $entry['voucher']->id, 'code' => $entry['voucher']->code,
                'issuerType' => $entry['voucher']->issuer_type->value, 'benefitType' => $entry['voucher']->benefit_type->value,
                'qualifyingBasis' => $this->money($entry['basis_cents']), 'discountAmount' => $this->money($entry['discount_cents']),
            ])->values(),
            'totals' => [
                'merchandiseSubtotal' => $this->money($group['subtotal_cents']), 'shippingFee' => $this->money($group['shipping_cents']),
                'discount' => $this->money($group['discount_cents']), 'shippingDiscount' => $this->money($group['shipping_discount_cents']),
                'payable' => $this->money($group['payable_cents']), 'currency' => config('checkout.currency', 'PHP'),
            ],
        ])->values()->all();
    }

    /** @param array<string, array<string, mixed>> $groups */
    private function summaryPayload(array $groups): array
    {
        return [
            'orderCount' => count($groups),
            'merchandiseSubtotal' => $this->money(collect($groups)->sum('subtotal_cents')),
            'shippingFee' => $this->money(collect($groups)->sum('shipping_cents')),
            'discount' => $this->money(collect($groups)->sum('discount_cents')),
            'shippingDiscount' => $this->money(collect($groups)->sum('shipping_discount_cents')),
            'payable' => $this->money(collect($groups)->sum('payable_cents')),
            'currency' => config('checkout.currency', 'PHP'),
        ];
    }

    private function addressPayload(Address $address): array
    {
        return [
            'id' => $address->id, 'label' => $address->label, 'recipientName' => $address->recipient_name,
            'contactNumber' => $address->contact_number, 'addressLine1' => $address->address_line_1,
            'addressLine2' => $address->address_line_2, 'barangay' => $address->barangay,
            'cityMunicipality' => $address->city_municipality, 'province' => $address->province,
            'region' => $address->region, 'postalCode' => $address->postal_code, 'country' => $address->country,
        ];
    }

    private function assertCompleteAddress(Address $address): void
    {
        foreach (['recipient_name', 'contact_number', 'address_line_1', 'barangay', 'city_municipality', 'province', 'region', 'postal_code', 'country'] as $field) {
            if (trim((string) $address->{$field}) === '') {
                throw CheckoutException::invalid('ADDRESS_INCOMPLETE', 'The selected address is incomplete.', 'address_id');
            }
        }
    }

    private function idempotentResult(CheckoutBatch $batch, string $requestHash): CheckoutBatch
    {
        if (! hash_equals($batch->request_hash, $requestHash)) {
            throw CheckoutException::conflict('IDEMPOTENCY_KEY_REUSED', 'This idempotency key was used for different checkout details.', 'idempotency_key');
        }

        return $this->loadBatch($batch);
    }

    private function loadBatch(CheckoutBatch $batch): CheckoutBatch
    {
        return $batch->fresh()->load(['orders' => fn ($query) => $query->orderBy('created_at')->orderBy('id'), 'orders.shop', 'orders.items', 'orders.address', 'orders.vouchers']);
    }

    private function hash(array $value): string
    {
        return hash('sha256', json_encode($value, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
    }

    private function cents(mixed $amount): int
    {
        $value = trim((string) $amount);
        if (! preg_match('/^(\d+)(?:\.(\d{1,2}))?$/', $value, $matches)) {
            throw new \InvalidArgumentException('Money values must have at most two decimal places.');
        }
        $fraction = str_pad($matches[2] ?? '', 2, '0');

        return ((int) $matches[1] * 100) + (int) $fraction;
    }

    private function percentageBasisPoints(mixed $percentage): int
    {
        return $this->cents($percentage);
    }

    private function isNonnegativeMoney(mixed $amount): bool
    {
        return preg_match('/^\d+(?:\.\d{1,2})?$/', trim((string) $amount)) === 1;
    }

    private function money(int $cents): string
    {
        return sprintf('%d.%02d', intdiv($cents, 100), $cents % 100);
    }
}
