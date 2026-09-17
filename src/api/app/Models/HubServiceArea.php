<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HubServiceArea extends Model
{
    use HasUuids;

    protected $fillable = ['logistics_hub_id', 'postal_code', 'is_active', 'revision', 'created_by'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'revision' => 'integer'];
    }

    public function hub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'logistics_hub_id');
    }
}
