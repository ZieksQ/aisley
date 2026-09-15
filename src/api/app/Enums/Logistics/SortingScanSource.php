<?php

namespace App\Enums\Logistics;

enum SortingScanSource: string
{
    case Barcode = 'barcode';
    case Manual = 'manual';
}
