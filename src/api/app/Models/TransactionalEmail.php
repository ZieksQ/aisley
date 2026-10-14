<?php

namespace App\Models;

use App\Enums\EmailDeliveryStatus;
use App\Enums\TransactionalEmailKind;
use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class TransactionalEmail extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'role', 'kind', 'deduplication_key', 'payload', 'status',
        'attempts', 'available_at', 'claim_token', 'claim_expires_at', 'accepted_at', 'last_error_code',
    ];

    protected $hidden = ['payload', 'claim_token'];

    protected function casts(): array
    {
        return [
            'role' => UserRole::class,
            'kind' => TransactionalEmailKind::class,
            'status' => EmailDeliveryStatus::class,
            'payload' => 'encrypted:array',
            'attempts' => 'integer',
            'available_at' => 'datetime',
            'claim_expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    public function scopeReady(Builder $query): void
    {
        $query->where(function (Builder $query): void {
            $query->where(function (Builder $query): void {
                $query->where('status', EmailDeliveryStatus::Pending)->where('available_at', '<=', now());
            })->orWhere(function (Builder $query): void {
                $query->whereIn('status', [EmailDeliveryStatus::Queued, EmailDeliveryStatus::Sending])
                    ->where('claim_expires_at', '<=', now());
            });
        });
    }
}
