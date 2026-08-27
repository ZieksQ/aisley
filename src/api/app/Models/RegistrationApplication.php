<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RegistrationApplication extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'user_id',
        'application_type',
        'status',
        'submitted_at',
        'reviewer_id',
        'reviewed_at',
        'rejection_reason',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    /**
     * @return HasMany<Document, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'application_type' => UserRole::class,
            'status' => ApplicationStatus::class,
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }
}
