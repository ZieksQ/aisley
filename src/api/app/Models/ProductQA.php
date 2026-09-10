<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductQA extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'product_qas';

    protected $fillable = [
        'product_id',
        'customer_id',
        'question_text',
        'question_idempotency_key',
        'question_request_hash',
        'answer_text',
        'answered_by_seller_id',
        'answer_idempotency_key',
        'answer_request_hash',
        'asked_at',
        'answered_at',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'asked_at' => 'datetime',
            'answered_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Product, $this> */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** @return BelongsTo<User, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    /** @return BelongsTo<User, $this> */
    public function answeredBySeller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'answered_by_seller_id');
    }
}
