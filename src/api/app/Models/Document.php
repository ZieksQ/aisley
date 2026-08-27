<?php

namespace App\Models;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Document extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'user_id',
        'registration_application_id',
        'reviewer_id',
        'type',
        'status',
        'disk',
        'path',
        'original_name',
        'mime_type',
        'size_bytes',
        'checksum',
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
     * @return BelongsTo<RegistrationApplication, $this>
     */
    public function registrationApplication(): BelongsTo
    {
        return $this->belongsTo(RegistrationApplication::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => DocumentType::class,
            'status' => DocumentStatus::class,
            'size_bytes' => 'integer',
            'reviewed_at' => 'datetime',
        ];
    }
}
