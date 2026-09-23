<?php

namespace App\Enums\Logistics;

enum LinehaulTripStatus: string
{
    case PendingAcceptance = 'pending_acceptance';
    case Scheduled = 'scheduled';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';
    case InTransfer = 'in_transfer';
    case Receiving = 'receiving';
    case Received = 'received';
}
