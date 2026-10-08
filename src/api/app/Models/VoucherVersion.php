<?php

namespace App\Models;

use App\Enums\VoucherVersionState;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use LogicException;

class VoucherVersion extends Model
{
    use HasUuids;

    protected $fillable = ['voucher_id', 'number', 'state', 'terms', 'actor_id', 'published_at'];

    protected static function booted(): void
    {
        static::updating(function (VoucherVersion $version): void {
            if ($version->getRawOriginal('state') !== 'draft') {
                throw new LogicException('Historical voucher versions are immutable.');
            }
        });
        static::deleting(fn () => throw new LogicException('Voucher versions cannot be deleted.'));
    }

    protected function casts(): array
    {
        return ['state' => VoucherVersionState::class, 'terms' => 'array', 'number' => 'integer', 'published_at' => 'datetime'];
    }
}
