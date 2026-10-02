<?php

namespace App\Http\Requests\Customer;

use App\Support\ScalarQueryParameters;
use Illuminate\Validation\Validator;

class ShopSearchRequest extends ProductSearchRequest
{
    public function after(): array
    {
        return [fn (Validator $validator) => ScalarQueryParameters::validate($this, $validator, ['q', 'page', 'limit'])];
    }
}
