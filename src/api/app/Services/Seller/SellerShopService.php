<?php

namespace App\Services\Seller;

use App\Models\Shop;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class SellerShopService
{
    public function for(User $seller): Shop
    {
        $shop = $seller->shop()->first();

        if (! $shop) {
            throw (new ModelNotFoundException)->setModel(Shop::class);
        }

        return $shop;
    }
}
