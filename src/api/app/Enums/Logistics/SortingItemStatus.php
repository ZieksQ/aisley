<?php

namespace App\Enums\Logistics;

enum SortingItemStatus: string
{
    case Pending = 'pending';
    case Sorted = 'sorted';
    case Exception = 'exception';
}
