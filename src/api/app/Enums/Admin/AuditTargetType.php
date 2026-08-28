<?php

namespace App\Enums\Admin;

use App\Models\RegistrationApplication;
use App\Models\User;

enum AuditTargetType: string
{
    case RegistrationApplication = 'registration_application';
    case AdminAccount = 'admin_account';

    public function label(): string
    {
        return match ($this) {
            self::RegistrationApplication => 'Registration',
            self::AdminAccount => 'Admin account',
        };
    }

    public function modelClass(): string
    {
        return match ($this) {
            self::RegistrationApplication => RegistrationApplication::class,
            self::AdminAccount => User::class,
        };
    }

    public static function fromModelClass(string $modelClass): ?self
    {
        return match ($modelClass) {
            RegistrationApplication::class => self::RegistrationApplication,
            User::class => self::AdminAccount,
            default => null,
        };
    }
}
