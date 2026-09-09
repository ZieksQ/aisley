<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WaybillSnapshot extends Model
{
    use HasUuids;

    protected $fillable = ['waybill_id', 'payload'];

    protected function casts(): array
    {
        return ['payload' => 'array'];
    }

    public function waybill(): BelongsTo
    {
        return $this->belongsTo(Waybill::class);
    }
}
