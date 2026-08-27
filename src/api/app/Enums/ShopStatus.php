<?php

namespace App\Enums;

enum ShopStatus: string
{
    case Active = 'active';
    case Suspended = 'suspended';
    case Deactivated = 'deactivated';
}
