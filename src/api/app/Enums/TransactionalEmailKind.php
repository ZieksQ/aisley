<?php

namespace App\Enums;

enum TransactionalEmailKind: string
{
    case AdminSetupCode = 'admin_setup_code';
    case RegistrationCode = 'registration_code';
    case PasswordChangeCode = 'password_change_code';
    case PasswordReset = 'password_reset';
    case RegistrationDecision = 'registration_decision';
}
