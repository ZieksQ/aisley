<?php

namespace App\Enums;

enum FirstMileTaskStatus: string
{
    case Assigned = 'assigned';
    case Accepted = 'accepted';
    case PickedUp = 'picked_up_from_seller';
    case Cancelled = 'cancelled';
}
