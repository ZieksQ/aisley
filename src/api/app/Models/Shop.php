<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Shop extends Model
{
    //
    protected $table = 'shops';

    protected $fillable = [
        'seller_id',
        'shop_category_id',
        'name',
        'slug',
        'description',
        'website',
    ];

    public function seller()
    {
        return $this->belongsTo(SellerProfile::class, 'seller_id', 'id');
    }

    public function shopCategory()
    {
        return $this->belongsTo(ShopCategories::class, 'shop_category_id', 'id');
    }
}

