<?php

namespace App\Enums;

enum FinanceAutomationKind: string
{
    case Collection = 'collection';
    case Seller = 'seller';
    case Logistics = 'logistics';
}
