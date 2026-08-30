<?php

namespace App\Enums;

enum AdminAuditAction: string
{
    case RegistrationApproved = 'registration.approved';
    case RegistrationRejected = 'registration.rejected';
    case AdminLoginSucceeded = 'admin.login_succeeded';
    case AdminProfileUpdated = 'admin_account.profile_updated';
    case AdminEmailUpdated = 'admin_account.email_updated';
    case AdminPasswordUpdated = 'admin_account.password_updated';
    case AdminProfilePhotoUpdated = 'admin_account.profile_photo_updated';
    case AdminProfilePhotoRemoved = 'admin_account.profile_photo_removed';

    public function label(): string
    {
        return match ($this) {
            self::RegistrationApproved => 'Registration approved',
            self::RegistrationRejected => 'Registration rejected',
            self::AdminLoginSucceeded => 'Admin signed in',
            self::AdminProfileUpdated => 'Admin profile updated',
            self::AdminEmailUpdated => 'Admin email updated',
            self::AdminPasswordUpdated => 'Admin password updated',
            self::AdminProfilePhotoUpdated => 'Admin profile photo updated',
            self::AdminProfilePhotoRemoved => 'Admin profile photo removed',
        };
    }
}
