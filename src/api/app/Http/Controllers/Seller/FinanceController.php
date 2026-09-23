<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Finance\AbstractFinanceController;

class FinanceController extends AbstractFinanceController
{
    protected function role(): string
    {
        return 'seller';
    }
}
