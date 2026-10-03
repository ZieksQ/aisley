<?php

namespace App\Enums;

enum CommissionPolicyStatus: string
{
    case Active = 'active';
    case Scheduled = 'scheduled';
    case Inactive = 'inactive';
    case Expired = 'expired';
}
