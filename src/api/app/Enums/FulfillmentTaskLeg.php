<?php

namespace App\Enums;

enum FulfillmentTaskLeg: string
{
    case FirstMile = 'first_mile';
    case FinalMile = 'final_mile';
}
