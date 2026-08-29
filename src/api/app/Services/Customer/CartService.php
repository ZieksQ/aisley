<?php

namespace App\Services\Customer;

use App\Enums\ProductStatus;
use App\Enums\ProductVariantStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\Customer\CartOperationException;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

class CartService
{
    public function show(User $customer): Cart
    {
        return DB::transaction(function () use ($customer): Cart {
            $cart = $this->lockedCart($customer);

            return $this->loadProjection($cart);
        });
    }

    /** @param array{product_id: string, variant_id: ?string, quantity: int} $data */
    public function add(User $customer, array $data): Cart
    {
        return DB::transaction(function () use ($customer, $data): Cart {
            $cart = $this->lockedCart($customer);
            $product = $this->purchasableProduct($data['product_id']);
            $variant = $this->eligibleVariant($product, $data['variant_id'], $data['quantity']);

            $item = CartItem::query()
                ->where('cart_id', $cart->id)
                ->where('product_id', $product->id)
                ->when(
                    $variant === null,
                    fn ($query) => $query->whereNull('variant_id'),
                    fn ($query) => $query->where('variant_id', $variant->id),
                )
                ->lockForUpdate()
                ->first();

            $quantity = ($item?->quantity ?? 0) + $data['quantity'];
            $this->assertStock($product, $variant, $quantity);

            if ($item === null) {
                $cart->items()->create([
                    'product_id' => $product->id,
                    'variant_id' => $variant?->id,
                    'quantity' => $quantity,
                ]);
            } else {
                $item->update(['quantity' => $quantity]);
            }

            return $this->loadProjection($cart);
        });
    }

    /** @param array{variant_id?: ?string, quantity?: int} $data */
    public function update(User $customer, string $itemId, array $data): Cart
    {
        return DB::transaction(function () use ($customer, $itemId, $data): Cart {
            $cart = $this->lockedCart($customer);
            $item = $this->scopedItem($cart, $itemId);
            $product = $this->purchasableProduct($item->product_id);
            $requestedQuantity = $data['quantity'] ?? $item->quantity;
            $variantId = array_key_exists('variant_id', $data)
                ? $data['variant_id']
                : $item->variant_id;
            $variant = $this->eligibleVariant($product, $variantId, $requestedQuantity);

            if ($variant?->id === $item->variant_id) {
                $item->update(['quantity' => $requestedQuantity]);

                return $this->loadProjection($cart);
            }

            $target = CartItem::query()
                ->where('cart_id', $cart->id)
                ->where('product_id', $product->id)
                ->when(
                    $variant === null,
                    fn ($query) => $query->whereNull('variant_id'),
                    fn ($query) => $query->where('variant_id', $variant->id),
                )
                ->whereKeyNot($item->id)
                ->lockForUpdate()
                ->first();

            if ($target === null) {
                $item->update([
                    'variant_id' => $variant?->id,
                    'quantity' => $requestedQuantity,
                ]);
            } else {
                $mergedQuantity = $target->quantity + $requestedQuantity;
                $this->assertStock($product, $variant, $mergedQuantity);
                $target->update(['quantity' => $mergedQuantity]);
                $item->delete();
            }

            return $this->loadProjection($cart);
        });
    }

    public function delete(User $customer, string $itemId): Cart
    {
        return DB::transaction(function () use ($customer, $itemId): Cart {
            $cart = $this->lockedCart($customer);
            $this->scopedItem($cart, $itemId)->delete();

            return $this->loadProjection($cart);
        });
    }

    private function lockedCart(User $customer): Cart
    {
        User::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();

        return Cart::query()->firstOrCreate(['customer_id' => $customer->id]);
    }

    private function scopedItem(Cart $cart, string $itemId): CartItem
    {
        $item = CartItem::query()
            ->where('cart_id', $cart->id)
            ->whereKey($itemId)
            ->lockForUpdate()
            ->first();

        if ($item === null) {
            throw (new ModelNotFoundException)->setModel(CartItem::class, [$itemId]);
        }

        return $item;
    }

    private function purchasableProduct(string $productId): Product
    {
        $product = Product::query()
            ->with(['shop.seller', 'optionGroups'])
            ->lockForUpdate()
            ->find($productId);

        if ($product === null) {
            throw CartOperationException::invalid(
                'PRODUCT_NOT_FOUND',
                'The selected product does not exist.',
                'product_id',
            );
        }

        $isVisible = $product->status === ProductStatus::Active
            && $product->published_at !== null
            && ! $product->published_at->isFuture()
            && $product->shop?->status === ShopStatus::Active
            && ! $product->shop->is_on_vacation
            && $product->shop->seller?->role === UserRole::Seller
            && $product->shop->seller?->status === UserStatus::Active;

        if (! $isVisible) {
            throw CartOperationException::conflict(
                'PRODUCT_UNAVAILABLE',
                'This product is no longer available to purchase.',
                'product_id',
            );
        }

        return $product;
    }

    private function eligibleVariant(Product $product, ?string $variantId, int $quantity): ?ProductVariant
    {
        $requiresVariant = $product->optionGroups->isNotEmpty();

        if ($requiresVariant && $variantId === null) {
            throw CartOperationException::invalid(
                'VARIANT_REQUIRED',
                'Select a complete product variation.',
                'variant_id',
            );
        }

        if (! $requiresVariant && $variantId !== null) {
            throw CartOperationException::invalid(
                'VARIANT_NOT_ALLOWED',
                'This product does not accept a variation.',
                'variant_id',
            );
        }

        if ($variantId === null) {
            $this->assertStock($product, null, $quantity);

            return null;
        }

        $variant = ProductVariant::query()
            ->with('optionValues.optionGroup')
            ->lockForUpdate()
            ->find($variantId);

        if ($variant === null || $variant->product_id !== $product->id) {
            throw CartOperationException::invalid(
                'INVALID_VARIANT',
                'The selected variation does not belong to this product.',
                'variant_id',
            );
        }

        $expectedGroupIds = $product->optionGroups->pluck('id')->sort()->values();
        $actualGroupIds = $variant->optionValues->pluck('option_group_id')->sort()->values();
        $isComplete = $variant->optionValues->count() === $expectedGroupIds->count()
            && $actualGroupIds->unique()->count() === $expectedGroupIds->count()
            && $actualGroupIds->all() === $expectedGroupIds->all();

        if (! $isComplete) {
            throw CartOperationException::invalid(
                'INVALID_VARIANT_COMBINATION',
                'The selected variation is incomplete or invalid.',
                'variant_id',
            );
        }

        if ($variant->status !== ProductVariantStatus::Active) {
            throw CartOperationException::conflict(
                'VARIANT_UNAVAILABLE',
                'The selected variation is no longer available.',
                'variant_id',
            );
        }

        $this->assertStock($product, $variant, $quantity);

        return $variant;
    }

    private function assertStock(Product $product, ?ProductVariant $variant, int $quantity): void
    {
        $available = $variant?->stock_quantity ?? $product->stock_quantity;

        if ($available < 1) {
            throw CartOperationException::conflict(
                'OUT_OF_STOCK',
                'The selected configuration is out of stock.',
                'quantity',
            );
        }

        if ($quantity > $available) {
            throw CartOperationException::conflict(
                'INSUFFICIENT_STOCK',
                "Only {$available} item(s) are currently available.",
                'quantity',
            );
        }
    }

    private function loadProjection(Cart $cart): Cart
    {
        return $cart->fresh()->load([
            'items' => fn ($query) => $query->orderBy('created_at')->orderBy('id'),
            'items.product.shop.seller',
            'items.product.optionGroups',
            'items.variant.optionValues.optionGroup',
            'items.variant.primaryMedia',
        ]);
    }
}
