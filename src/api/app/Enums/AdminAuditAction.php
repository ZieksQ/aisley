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
    case AnnouncementCreated = 'platform_settings.announcement_created';
    case AnnouncementUpdated = 'platform_settings.announcement_updated';
    case AnnouncementPublished = 'platform_settings.announcement_published';
    case AnnouncementArchived = 'platform_settings.announcement_archived';
    case PolicyVersionCreated = 'platform_settings.policy_version_created';
    case PolicySuccessorCreated = 'platform_settings.policy_successor_created';
    case PolicyVersionUpdated = 'platform_settings.policy_version_updated';
    case PolicyVersionPublished = 'platform_settings.policy_version_published';

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
            self::AnnouncementCreated => 'Announcement created',
            self::AnnouncementUpdated => 'Announcement updated',
            self::AnnouncementPublished => 'Announcement published',
            self::AnnouncementArchived => 'Announcement archived',
            self::PolicyVersionCreated => 'Policy version created',
            self::PolicySuccessorCreated => 'Policy successor draft created',
            self::PolicyVersionUpdated => 'Policy version updated',
            self::PolicyVersionPublished => 'Policy version published',
        };
    }
}
