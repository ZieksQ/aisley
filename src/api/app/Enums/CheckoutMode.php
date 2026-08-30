<?php

namespace App\Enums;

enum CheckoutMode: string
{
    case Cart = 'cart';
    case BuyNow = 'buy_now';
}
