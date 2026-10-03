<?php

namespace App\Enums;

enum LogisticsServiceType: string
{
    case FirstMile = 'first_mile';
    case Linehaul = 'linehaul';
    case LastMile = 'last_mile';
}
