<?php

namespace App\Enums;

enum ShipmentEvidenceStatus: string
{
    case Submitted = 'submitted';
    case AwaitingValidation = 'awaiting_validation';
    case Validated = 'validated';
    case Rejected = 'rejected';
    case Unavailable = 'unavailable';
}
