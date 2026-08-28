<?php

namespace App\Enums;

enum AdminAuditAction: string
{
    case RegistrationApproved = 'registration.approved';
    case RegistrationRejected = 'registration.rejected';

    public function label(): string
    {
        return match ($this) {
            self::RegistrationApproved => 'Registration approved',
            self::RegistrationRejected => 'Registration rejected',
        };
    }
}
