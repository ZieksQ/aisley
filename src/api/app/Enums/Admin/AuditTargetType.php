<?php

namespace App\Enums\Admin;

use App\Models\AccountLifecycleEvent;
use App\Models\Announcement;
use App\Models\PlatformPolicyVersion;
use App\Models\RegistrationApplication;
use App\Models\User;

enum AuditTargetType: string
{
    case RegistrationApplication = 'registration_application';
    case AdminAccount = 'admin_account';
    case Announcement = 'announcement';
    case PlatformPolicyVersion = 'platform_policy_version';
    case AccountLifecycleEvent = 'account_lifecycle_event';

    public function label(): string
    {
        return match ($this) {
            self::RegistrationApplication => 'Registration',
            self::AdminAccount => 'Admin account',
            self::Announcement => 'Announcement',
            self::PlatformPolicyVersion => 'Policy version',
            self::AccountLifecycleEvent => 'Account lifecycle event',
        };
    }

    public function modelClass(): string
    {
        return match ($this) {
            self::RegistrationApplication => RegistrationApplication::class,
            self::AdminAccount => User::class,
            self::Announcement => Announcement::class,
            self::PlatformPolicyVersion => PlatformPolicyVersion::class,
            self::AccountLifecycleEvent => AccountLifecycleEvent::class,
        };
    }

    public static function fromModelClass(string $modelClass): ?self
    {
        return match ($modelClass) {
            RegistrationApplication::class => self::RegistrationApplication,
            User::class => self::AdminAccount,
            Announcement::class => self::Announcement,
            PlatformPolicyVersion::class => self::PlatformPolicyVersion,
            AccountLifecycleEvent::class => self::AccountLifecycleEvent,
            default => null,
        };
    }
}
