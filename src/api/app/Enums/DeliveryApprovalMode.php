<?php

namespace App\Enums;

enum DeliveryApprovalMode: string
{
    case Manual = 'manual';
    case Automatic = 'automatic';
}
