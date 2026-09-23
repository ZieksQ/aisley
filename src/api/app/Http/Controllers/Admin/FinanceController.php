<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Finance\AbstractFinanceController;

class FinanceController extends AbstractFinanceController
{
    protected function role(): string
    {
        return 'admin';
    }
}
