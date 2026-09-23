<?php

namespace App\Enums\Logistics;

enum UnloadingOutcome: string
{
    case Clean = 'clean';
    case Discrepancies = 'discrepancies';
}
