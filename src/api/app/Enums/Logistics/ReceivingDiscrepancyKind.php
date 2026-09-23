<?php

namespace App\Enums\Logistics;

enum ReceivingDiscrepancyKind: string
{
    case Missing = 'missing';
    case Damaged = 'damaged';
    case Unexpected = 'unexpected';
}
