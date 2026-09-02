<?php

namespace App\Enums\Seller;

enum LowStockAlertResolutionReason: string
{
    case StockRecovered = 'stock_recovered';
    case ThresholdDisabled = 'threshold_disabled';
}
