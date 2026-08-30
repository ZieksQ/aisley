<?php

namespace App\Enums;

enum VoucherValueType: string
{
    case Fixed = 'fixed';
    case Percent = 'percent';
}
