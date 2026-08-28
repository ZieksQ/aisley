<?php

namespace App\Enums\Admin;

use App\Models\RegistrationApplication;

enum AuditTargetType: string
{
    case RegistrationApplication = 'registration_application';

    public function label(): string
    {
        return match ($this) {
            self::RegistrationApplication => 'Registration',
        };
    }

    public function modelClass(): string
    {
        return match ($this) {
            self::RegistrationApplication => RegistrationApplication::class,
        };
    }

    public static function fromModelClass(string $modelClass): ?self
    {
        return match ($modelClass) {
            RegistrationApplication::class => self::RegistrationApplication,
            default => null,
        };
    }
}
