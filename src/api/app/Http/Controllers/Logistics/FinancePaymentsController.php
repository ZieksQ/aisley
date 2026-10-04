<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Finance\AbstractPaymentsController;

class FinancePaymentsController extends AbstractPaymentsController
{
    protected function role(): string
    {
        return 'logistics';
    }
}
