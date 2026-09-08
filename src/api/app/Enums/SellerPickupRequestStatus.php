<?php

namespace App\Enums;

enum SellerPickupRequestStatus: string
{
    case PendingLogistics = 'pending_logistics';
    case PartiallyScheduled = 'partially_scheduled';
    case Scheduled = 'scheduled';
}
