<?php

namespace App\Enums\Logistics;

enum HubRouteHopStatus: string
{
    case Pending = 'pending';
    case InTransfer = 'in_transfer';
    case Arrived = 'arrived';
}
