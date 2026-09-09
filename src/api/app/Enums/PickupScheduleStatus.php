<?php

namespace App\Enums;

enum PickupScheduleStatus: string
{
    case Scheduled = 'scheduled';
    case Cancelled = 'cancelled';
    case Completed = 'completed';
}
