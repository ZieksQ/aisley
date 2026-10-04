<?php

namespace App\Enums;

enum FinancePaymentDirection: string
{
    case Collection = 'collection';
    case Payout = 'payout';
}
