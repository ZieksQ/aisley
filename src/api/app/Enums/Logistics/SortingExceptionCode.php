<?php

namespace App\Enums\Logistics;

enum SortingExceptionCode: string
{
    case Damaged = 'damaged';
    case UnreadableLabel = 'unreadable_label';
    case DestinationUnclear = 'destination_unclear';
    case Other = 'other';
}
