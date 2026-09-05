<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LogisticsHub extends Model
{
    use HasUuids;

    protected $fillable = ['logistics_organization_id', 'address_id', 'name'];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class);
    }
}
