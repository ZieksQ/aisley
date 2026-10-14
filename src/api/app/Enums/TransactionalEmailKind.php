<?php

namespace App\Enums;

enum TransactionalEmailKind: string
{
    case PasswordChangeCode = 'password_change_code';
    case PasswordReset = 'password_reset';
    case RegistrationDecision = 'registration_decision';
}
