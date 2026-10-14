<?php

namespace App\Enums;

enum TransactionalEmailKind: string
{
    case PasswordReset = 'password_reset';
    case RegistrationDecision = 'registration_decision';
}
