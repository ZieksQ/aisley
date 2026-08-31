<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductComplianceRestriction extends Model
{
    use HasUuids;

    protected $fillable = [
        'product_id', 'case_id', 'policy_version_id', 'active_marker', 'reason',
        'imposed_by_admin_id', 'revoked_by_admin_id', 'revocation_reason', 'imposed_at', 'revoked_at',
    ];

    protected function casts(): array
    {
        return ['imposed_at' => 'datetime', 'revoked_at' => 'datetime'];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function complianceCase(): BelongsTo
    {
        return $this->belongsTo(SellerComplianceCase::class, 'case_id');
    }

    public function policyVersion(): BelongsTo
    {
        return $this->belongsTo(PlatformPolicyVersion::class, 'policy_version_id');
    }

    public function imposedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imposed_by_admin_id');
    }

    public function revokedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoked_by_admin_id');
    }
}
