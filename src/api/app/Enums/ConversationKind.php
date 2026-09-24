<?php

namespace App\Enums;

enum ConversationKind: string
{
    case CustomerShop = 'customer_shop';
    case LogisticsCourier = 'logistics_courier';
    case CustomerLogistics = 'customer_logistics';
    case SellerLogistics = 'seller_logistics';
    case CourierSeller = 'courier_seller';
    case CourierCustomer = 'courier_customer';
}
