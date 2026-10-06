<?php

namespace App\Enums\Logistics;

enum SortingActivationStatus: string
{
    case Scheduled = 'scheduled';
    case Activated = 'activated';
    case Failed = 'failed';
    case Cancelled = 'cancelled';
}
