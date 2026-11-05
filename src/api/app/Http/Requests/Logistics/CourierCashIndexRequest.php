<?php

namespace App\Http\Requests\Logistics;

use App\Http\Requests\Finance\DateRangeRules;
use Illuminate\Foundation\Http\FormRequest;

class CourierCashIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [...DateRangeRules::rules(), 'courier_id' => ['sometimes', 'uuid'], 'currency' => ['sometimes', 'string', 'size:3'],
            'page' => ['sometimes', 'integer', 'min:1'], 'per_page' => ['sometimes', 'integer', 'between:1,50']];
    }
}
