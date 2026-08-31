<?php

namespace App\Enums;

enum PlatformPolicyType: string
{
    case TermsOfService = 'terms_of_service';
    case PrivacyPolicy = 'privacy_policy';
    case InternalRules = 'internal_rules';

    public function label(): string
    {
        return match ($this) {
            self::TermsOfService => 'Terms of Service',
            self::PrivacyPolicy => 'Privacy Policy',
            self::InternalRules => 'Internal Platform Rules',
        };
    }
}
