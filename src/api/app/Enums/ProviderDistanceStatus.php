<?php

namespace App\Enums;

enum ProviderDistanceStatus: string
{
    case Calculated = 'calculated';
    case Unavailable = 'unavailable';
}
