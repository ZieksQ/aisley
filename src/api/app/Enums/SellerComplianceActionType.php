<?php

namespace App\Enums;

enum SellerComplianceActionType: string
{
    case CaseDismissed = 'case_dismissed';
    case CaseClosed = 'case_closed';
    case WarningIssued = 'warning_issued';
    case ProductRestricted = 'product_restricted';
    case ProductRestrictionRevoked = 'product_restriction_revoked';
    case SellerSuspensionReferred = 'seller_suspension_referred';

    public function label(): string
    {
        return match ($this) {
            self::CaseDismissed => 'Case dismissed',
            self::CaseClosed => 'Case closed',
            self::WarningIssued => 'Warning issued',
            self::ProductRestricted => 'Product restricted',
            self::ProductRestrictionRevoked => 'Product restriction revoked',
            self::SellerSuspensionReferred => 'Seller suspension referred',
        };
    }
}
