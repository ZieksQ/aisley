<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class LogisticsOrganization extends Model
{
    use HasUuids;

    protected $fillable = ['user_id', 'business_name'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function hub(): HasOne
    {
        return $this->hasOne(LogisticsHub::class, 'logistics_organization_id');
    }

    public function courierAffiliations(): HasMany
    {
        return $this->hasMany(CourierLogisticsAffiliation::class);
    }
}
