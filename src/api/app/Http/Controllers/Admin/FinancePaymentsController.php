<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Finance\AbstractPaymentsController;

class FinancePaymentsController extends AbstractPaymentsController
{
    protected function role(): string
    {
        return 'admin';
    }
}
