<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Messaging\CourierCounterpartyConversationController;

class CourierConversationController extends CourierCounterpartyConversationController
{
    protected function role(): string
    {
        return 'seller';
    }
}
