<?php

namespace App\Enums\Logistics;

enum SortingScanOutcome: string
{
    case Sorted = 'sorted';
    case Exception = 'exception';
}
