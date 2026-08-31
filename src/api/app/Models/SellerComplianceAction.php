<?php

namespace App\Models;

use App\Enums\SellerComplianceActionType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerComplianceAction extends Model
{
    use HasUuids;

    protected $fillable = ['case_id', 'action', 'reason', 'acted_by_admin_id', 'restriction_id', 'account_lifecycle_event_id', 'idempotency_key', 'occurred_at'];

    protected function casts(): array
    {
        return ['action' => SellerComplianceActionType::class, 'occurred_at' => 'datetime'];
    }

    public function complianceCase(): BelongsTo
    {
        return $this->belongsTo(SellerComplianceCase::class, 'case_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acted_by_admin_id');
    }

    public function restriction(): BelongsTo
    {
        return $this->belongsTo(ProductComplianceRestriction::class, 'restriction_id');
    }

    public function accountLifecycleEvent(): BelongsTo
    {
        return $this->belongsTo(AccountLifecycleEvent::class);
    }
}
