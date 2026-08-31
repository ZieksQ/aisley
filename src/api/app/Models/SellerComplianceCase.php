<?php

namespace App\Models;

use App\Enums\SellerComplianceCaseStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SellerComplianceCase extends Model
{
    use HasUuids;

    protected $fillable = [
        'seller_id', 'product_id', 'policy_version_id', 'source_type', 'source_reference_id',
        'reason', 'status', 'revision', 'created_by_admin_id', 'dismissed_by_admin_id',
        'closed_by_admin_id', 'dismissal_note', 'confirmed_at', 'dismissed_at', 'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => SellerComplianceCaseStatus::class,
            'revision' => 'integer',
            'confirmed_at' => 'datetime',
            'dismissed_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function policyVersion(): BelongsTo
    {
        return $this->belongsTo(PlatformPolicyVersion::class, 'policy_version_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_admin_id');
    }

    public function dismissedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dismissed_by_admin_id');
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by_admin_id');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(SellerComplianceAction::class, 'case_id');
    }

    public function restrictions(): HasMany
    {
        return $this->hasMany(ProductComplianceRestriction::class, 'case_id');
    }
}
