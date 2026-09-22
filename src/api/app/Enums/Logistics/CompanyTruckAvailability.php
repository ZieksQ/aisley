<?php

namespace App\Enums\Logistics;

enum CompanyTruckAvailability: string
{
    case Available = 'available';
    case Reserved = 'reserved';
    case InTransit = 'in_transit';
    case Visiting = 'visiting';
    case Inactive = 'inactive';
}
