<?php

namespace App\Models;

use App\Enums\Logistics\ReceivingDiscrepancyKind;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LinehaulDiscrepancy extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['kind' => ReceivingDiscrepancyKind::class, 'resolved_at' => 'immutable_datetime'];
    }
}
