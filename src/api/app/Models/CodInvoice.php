<?php

namespace App\Models;

use App\Enums\CodInvoiceStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CodInvoice extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['status' => CodInvoiceStatus::class, 'total_cents' => 'integer', 'delivered_at' => 'immutable_datetime', 'due_at' => 'immutable_datetime', 'seller_eligible_at' => 'immutable_datetime', 'logistics_eligible_at' => 'immutable_datetime', 'paid_at' => 'immutable_datetime', 'notified_at' => 'immutable_datetime', 'overdue_notified_at' => 'immutable_datetime'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
