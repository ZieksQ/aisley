<?php

namespace App\Models;

use App\Enums\Logistics\SortingExceptionCode;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SortingException extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['exception_code' => SortingExceptionCode::class, 'attempts' => 'integer', 'revision' => 'integer', 'recorded_at' => 'immutable_datetime', 'last_attempt_at' => 'immutable_datetime', 'released_at' => 'immutable_datetime', 'resolved_at' => 'immutable_datetime'];
    }
}
