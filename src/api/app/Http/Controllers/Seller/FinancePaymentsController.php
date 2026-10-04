<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Finance\AbstractPaymentsController;

class FinancePaymentsController extends AbstractPaymentsController
{
    protected function role(): string
    {
        return 'seller';
    }
}
