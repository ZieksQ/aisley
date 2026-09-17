<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HubConnection extends Model
{
    use HasUuids;

    protected $fillable = ['from_hub_id', 'to_hub_id', 'is_active', 'revision', 'created_by'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'revision' => 'integer'];
    }

    public function fromHub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'from_hub_id');
    }

    public function toHub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'to_hub_id');
    }
}
