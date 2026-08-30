<?php

namespace App\Enums\Customer;

enum CustomerOrderGroup: string
{
    case ToPay = 'to_pay';
    case ToPrepare = 'to_prepare';
    case ToShip = 'to_ship';
    case OutForDelivery = 'out_for_delivery';
    case Completed = 'completed';
    case CancelledIssue = 'cancelled_issue';
}
