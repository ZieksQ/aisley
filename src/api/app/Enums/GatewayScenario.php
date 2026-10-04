<?php

namespace App\Enums;

enum GatewayScenario: string
{
    case Success = 'success';
    case Failure = 'failure';
    case InsufficientFunds = 'insufficient_funds';
    case Delay = 'delay';
    case DuplicateCallback = 'duplicate_callback';
    case LostResponse = 'lost_response';
}
