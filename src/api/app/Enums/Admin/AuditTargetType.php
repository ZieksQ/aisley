<?php

namespace App\Enums\Admin;

use App\Models\AccountLifecycleEvent;
use App\Models\Announcement;
use App\Models\PlatformPolicyVersion;
use App\Models\ProductComplianceRestriction;
use App\Models\RegistrationApplication;
use App\Models\SellerComplianceAction;
use App\Models\SellerComplianceCase;
use App\Models\User;

enum AuditTargetType: string
{
    case RegistrationApplication = 'registration_application';
    case AdminAccount = 'admin_account';
    case Announcement = 'announcement';
    case PlatformPolicyVersion = 'platform_policy_version';
    case AccountLifecycleEvent = 'account_lifecycle_event';
    case SellerComplianceCase = 'seller_compliance_case';
    case SellerComplianceAction = 'seller_compliance_action';
    case ProductComplianceRestriction = 'product_compliance_restriction';

    public function label(): string
    {
        return match ($this) {
            self::RegistrationApplication => 'Registration',
            self::AdminAccount => 'Admin account',
            self::Announcement => 'Announcement',
            self::PlatformPolicyVersion => 'Policy version',
            self::AccountLifecycleEvent => 'Account lifecycle event',
            self::SellerComplianceCase => 'Seller compliance case',
            self::SellerComplianceAction => 'Seller compliance action',
            self::ProductComplianceRestriction => 'Product compliance restriction',
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
            self::SellerComplianceCase => SellerComplianceCase::class,
            self::SellerComplianceAction => SellerComplianceAction::class,
            self::ProductComplianceRestriction => ProductComplianceRestriction::class,
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
            SellerComplianceCase::class => self::SellerComplianceCase,
            SellerComplianceAction::class => self::SellerComplianceAction,
            ProductComplianceRestriction::class => self::ProductComplianceRestriction,
            default => null,
        };
    }
}
