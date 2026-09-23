<?php

namespace App\Enums\Logistics;

enum ReceiptCondition: string
{
    case Good = 'good';
    case Damaged = 'damaged';
}
