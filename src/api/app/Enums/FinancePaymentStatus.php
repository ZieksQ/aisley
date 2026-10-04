<?php

namespace App\Enums;

enum FinancePaymentStatus: string
{
    case Reserved = 'reserved';
    case Pending = 'pending';
    case Unknown = 'unknown';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
}
