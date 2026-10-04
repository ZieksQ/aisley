<?php

namespace App\Enums;

enum CodInvoiceStatus: string
{
    case Outstanding = 'outstanding';
    case Processing = 'processing';
    case Paid = 'paid';
    case Review = 'review';
}
