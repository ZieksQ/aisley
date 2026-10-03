<?php

namespace App\Enums;

enum ShippingPricingModel: string
{
    case PlatformBase = 'platform_base_v1';
    case LogisticsServiceBase = 'logistics_service_base_v1';
}
