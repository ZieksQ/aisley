<?php

namespace App\Models;

use App\Enums\InventoryMovementType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class InventoryMovement extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    protected $fillable = [
        'inventory_balance_id',
        'movement_type',
        'on_hand_delta',
        'reserved_delta',
        'resulting_on_hand',
        'resulting_reserved',
        'reference_type',
        'reference_id',
        'idempotency_key',
        'actor_id',
        'reason',
    ];

    protected function casts(): array
    {
        return [
            'movement_type' => InventoryMovementType::class,
            'on_hand_delta' => 'integer',
            'reserved_delta' => 'integer',
            'resulting_on_hand' => 'integer',
            'resulting_reserved' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function balance(): BelongsTo
    {
        return $this->belongsTo(InventoryBalance::class, 'inventory_balance_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Inventory movements are immutable.'));
        static::deleting(fn () => throw new LogicException('Inventory movements are immutable.'));
    }
}
