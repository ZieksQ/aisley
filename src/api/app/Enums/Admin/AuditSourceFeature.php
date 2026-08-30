<?php

namespace App\Enums\Admin;

enum AuditSourceFeature: string
{
    case AccountApproval = 'account_approval';
    case AdminAuthentication = 'admin_authentication';
    case AdminAccountManagement = 'admin_account_management';

    public function label(): string
    {
        return match ($this) {
            self::AccountApproval => 'Account Approval',
            self::AdminAuthentication => 'Admin Authentication',
            self::AdminAccountManagement => 'Admin Account Management',
        };
    }
}
