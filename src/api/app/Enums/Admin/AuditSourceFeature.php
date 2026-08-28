<?php

namespace App\Enums\Admin;

enum AuditSourceFeature: string
{
    case AccountApproval = 'account_approval';

    public function label(): string
    {
        return match ($this) {
            self::AccountApproval => 'Account Approval',
        };
    }
}
