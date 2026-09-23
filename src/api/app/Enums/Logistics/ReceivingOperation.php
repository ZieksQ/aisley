<?php

namespace App\Enums\Logistics;

enum ReceivingOperation: string
{
    case Start = 'start';
    case Scan = 'scan';
    case Finish = 'finish';
    case Resolve = 'resolve';
}
