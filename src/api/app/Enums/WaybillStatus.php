<?php

namespace App\Enums;

enum WaybillStatus: string
{
    case Active = 'active';
    case Void = 'void';
}
