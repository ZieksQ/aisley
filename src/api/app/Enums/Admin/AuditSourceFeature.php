<?php

namespace App\Enums\Admin;

enum AuditSourceFeature: string
{
    case AccountApproval = 'account_approval';
    case AdminAuthentication = 'admin_authentication';

    public function label(): string
    {
        return match ($this) {
            self::AccountApproval => 'Account Approval',
            self::AdminAuthentication => 'Admin Authentication',
        };
    }
}
