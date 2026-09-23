<?php

namespace App\Models;

use App\Enums\Logistics\ReceiptCondition;
use App\Enums\Logistics\SortingScanSource;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LinehaulReceipt extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['condition' => ReceiptCondition::class, 'source' => SortingScanSource::class, 'result' => 'array', 'captured_at' => 'immutable_datetime', 'committed_at' => 'immutable_datetime'];
    }
}
