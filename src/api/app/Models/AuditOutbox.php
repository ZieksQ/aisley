<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditOutbox extends Model
{
    use HasUuids;

    protected $table = 'audit_outbox';

    protected $fillable = [
        'id',
        'actor_id',
        'actor_name',
        'action',
        'source_feature',
        'auditable_type',
        'auditable_id',
        'target_snapshot',
        'old_values',
        'new_values',
        'changed_fields',
        'metadata',
        'request_id',
        'schema_version',
        'ip_address',
        'user_agent',
        'occurred_at',
        'attempts',
        'available_at',
        'processed_at',
        'last_error',
    ];

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'target_snapshot' => 'array',
            'old_values' => 'array',
            'new_values' => 'array',
            'changed_fields' => 'array',
            'metadata' => 'array',
            'schema_version' => 'integer',
            'attempts' => 'integer',
            'occurred_at' => 'datetime',
            'available_at' => 'datetime',
            'processed_at' => 'datetime',
        ];
    }
}
