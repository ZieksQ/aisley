<?php

namespace App\Enums\Logistics;

enum HubRouteStatus: string
{
    case Local = 'local';
    case Planned = 'planned';
    case Unresolved = 'unresolved';
    case Unavailable = 'unavailable';
    case Completed = 'completed';
}
