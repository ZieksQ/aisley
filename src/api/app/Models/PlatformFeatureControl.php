<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlatformFeatureControl extends Model
{
    use HasUuids;

    public const POLICY_CONSENT_ENFORCEMENT = 'policy_consent_enforcement';

    protected $fillable = [
        'key',
        'label',
        'description',
        'enabled',
        'revision',
        'updated_by_admin_id',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'revision' => 'integer',
        ];
    }

    public function updatedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by_admin_id');
    }
}
