<?php

namespace App\Enums;

enum VoucherDistributionMode: string
{
    case Automatic = 'automatic';
    case ClaimRequired = 'claim_required';
}
