<?php

namespace App\Models;

use App\Enums\Logistics\ReceivingOperation;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LinehaulReceivingAction extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['operation' => ReceivingOperation::class, 'payload' => 'array', 'result' => 'array'];
    }
}
