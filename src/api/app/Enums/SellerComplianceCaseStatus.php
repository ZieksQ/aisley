<?php

namespace App\Enums;

enum SellerComplianceCaseStatus: string
{
    case Open = 'open';
    case Confirmed = 'confirmed';
    case Dismissed = 'dismissed';
    case Closed = 'closed';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
