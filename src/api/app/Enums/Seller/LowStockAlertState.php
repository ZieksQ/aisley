<?php

namespace App\Enums\Seller;

enum LowStockAlertState: string
{
    case Active = 'active';
    case Resolved = 'resolved';
}
