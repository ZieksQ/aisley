<?php

namespace App\Enums;

enum SupportTicketCategory: string
{
    case General = 'general';
    case Account = 'account';
    case Order = 'order';
    case Delivery = 'delivery';
}
