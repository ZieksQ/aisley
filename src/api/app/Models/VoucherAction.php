<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class VoucherAction extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $fillable = ['voucher_id', 'actor_id', 'action', 'revision', 'details'];

    protected function casts(): array
    {
        return ['revision' => 'integer', 'details' => 'array', 'created_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Voucher actions are append-only.'));
        static::deleting(fn () => throw new LogicException('Voucher actions are append-only.'));
    }
}
