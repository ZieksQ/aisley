<?php

namespace App\Enums;

enum InventoryMovementType: string
{
    case Restock = 'restock';
    case ManualIncrease = 'manual_increase';
    case ManualDecrease = 'manual_decrease';
    case Correction = 'correction';
    case Reserve = 'reserve';
    case Release = 'release';
    case Fulfillment = 'fulfillment';
    case ReturnIn = 'return_in';
}
