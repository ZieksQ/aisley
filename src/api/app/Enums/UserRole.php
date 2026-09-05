<?php

namespace App\Enums;

enum UserRole: string
{
    case Customer = 'customer';
    case Seller = 'seller';
    case Admin = 'admin';
    case Courier = 'courier';
    case Logistics = 'logistics';
}
