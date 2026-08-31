<?php

namespace App\Enums;

enum AccountLifecycleAction: string
{
    case Suspended = 'suspended';
    case Restored = 'restored';
    case Deactivated = 'deactivated';

    public function label(): string
    {
        return match ($this) {
            self::Suspended => 'Account suspended',
            self::Restored => 'Account restored',
            self::Deactivated => 'Account deactivated',
        };
    }
}
