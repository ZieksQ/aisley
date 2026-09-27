<?php

namespace App\Enums;

enum ShippingRoutePricingStatus: string
{
    case Local = 'local';
    case Planned = 'planned';
    case Unplanned = 'unplanned';
}
