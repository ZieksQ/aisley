<?php

namespace App\Enums;

enum PickupReleaseReason: string
{
    case Rejected = 'rejected';
    case FailedPickupLimit = 'failed_pickup_limit';
    case RetryExpired = 'retry_expired';
}
