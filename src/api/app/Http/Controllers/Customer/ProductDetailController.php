<?php

namespace App\Http\Controllers\Customer;

use App\Enums\ProductVariantStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Customer\ProductDetailResource;
use App\Models\Product;

class ProductDetailController extends Controller
{
    public function show(string $id): ProductDetailResource
    {
        $product = Product::query()
            ->storefrontVisible()
            ->with([
                'shop',
                'media' => fn ($query) => $query->orderBy('position'),
                'optionGroups' => fn ($query) => $query
                    ->orderBy('position')
                    ->with(['values' => fn ($values) => $values->orderBy('position')]),
                'variants' => fn ($query) => $query
                    ->where('status', ProductVariantStatus::Active)
                    ->with(['optionValues.optionGroup', 'primaryMedia']),
            ])
            ->findOrFail($id);

        return new ProductDetailResource($product);
    }
}
