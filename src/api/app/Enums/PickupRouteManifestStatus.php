<?php

namespace App\Enums;

enum PickupRouteManifestStatus: string
{
    case Pending = 'pending';
    case Ready = 'ready';
    case Unavailable = 'unavailable';
}
