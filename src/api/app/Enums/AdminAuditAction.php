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
    case HomepageAdvertisementDraftCreated = 'platform_settings.homepage_advertisement_draft_created';
    case HomepageAdvertisementDraftUpdated = 'platform_settings.homepage_advertisement_draft_updated';
    case HomepageAdvertisementPublished = 'platform_settings.homepage_advertisement_published';
    case HomepageAdvertisementArchived = 'platform_settings.homepage_advertisement_archived';
    case UserAccountSuspended = 'user_account.suspended';
    case UserAccountRestored = 'user_account.restored';
    case UserAccountDeactivated = 'user_account.deactivated';
    case SellerComplianceCaseCreated = 'seller_compliance.case_created';
    case SellerComplianceCaseDismissed = 'seller_compliance.case_dismissed';
    case SellerComplianceCaseClosed = 'seller_compliance.case_closed';
    case SellerComplianceWarningIssued = 'seller_compliance.warning_issued';
    case SellerComplianceProductRestricted = 'seller_compliance.product_restricted';
    case SellerComplianceProductRestrictionRevoked = 'seller_compliance.product_restriction_revoked';
    case SellerComplianceSuspensionReferred = 'seller_compliance.suspension_referred';

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
            self::HomepageAdvertisementDraftCreated => 'Homepage advertisement draft created',
            self::HomepageAdvertisementDraftUpdated => 'Homepage advertisement draft updated',
            self::HomepageAdvertisementPublished => 'Homepage advertisement published',
            self::HomepageAdvertisementArchived => 'Homepage advertisement archived',
            self::UserAccountSuspended => 'User account suspended',
            self::UserAccountRestored => 'User account restored',
            self::UserAccountDeactivated => 'User account deactivated',
            self::SellerComplianceCaseCreated => 'Seller compliance case created',
            self::SellerComplianceCaseDismissed => 'Seller compliance case dismissed',
            self::SellerComplianceCaseClosed => 'Seller compliance case closed',
            self::SellerComplianceWarningIssued => 'Seller compliance warning issued',
            self::SellerComplianceProductRestricted => 'Product restricted for compliance',
            self::SellerComplianceProductRestrictionRevoked => 'Product compliance restriction revoked',
            self::SellerComplianceSuspensionReferred => 'Seller suspension referred from compliance',
        };
    }
}
