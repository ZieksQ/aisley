<?php

namespace App\Enums\Logistics;

enum SortingLaneType: string
{
    case Standard = 'standard';
    case Exception = 'exception';
}
