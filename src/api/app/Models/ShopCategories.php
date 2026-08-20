<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ShopCategories extends Model
{
    //
    protected $table = 'shop_categories';

    protected $fillable = [
        'name',
        'description',
    ];

    public function shops()
    {
        return $this->hasMany(Shop::class, 'shop_category_id', 'id');
    }
}
