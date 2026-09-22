<?php

namespace App\Enums\Logistics;

enum LinehaulTripDirection: string
{
    case Outbound = 'outbound';
    case Return = 'return';
}
