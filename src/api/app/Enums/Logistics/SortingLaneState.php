<?php

namespace App\Enums\Logistics;

enum SortingLaneState: string
{
    case Open = 'open';
    case Paused = 'paused';
    case Held = 'held';
}
