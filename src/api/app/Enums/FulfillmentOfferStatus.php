<?php

namespace App\Enums;

enum FulfillmentOfferStatus: string
{
    case Offered = 'offered';
    case Accepted = 'accepted';
    case Rejected = 'rejected';
}
