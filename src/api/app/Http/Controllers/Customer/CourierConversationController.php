<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Messaging\CourierCounterpartyConversationController;

class CourierConversationController extends CourierCounterpartyConversationController
{
    protected function role(): string
    {
        return 'customer';
    }
}
