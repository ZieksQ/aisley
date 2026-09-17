<?php

namespace App\Enums\Logistics;

enum SortingDestinationType: string
{
    case PostalCode = 'postal_code';
    case Hub = 'hub';
}
