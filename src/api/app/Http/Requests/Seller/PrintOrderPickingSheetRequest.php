<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;

class PrintOrderPickingSheetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'order_ids' => ['required', 'array', 'list', 'min:1', 'max:50'],
            'order_ids.*' => ['required', 'uuid', 'distinct:ignore_case'],
        ];
    }
}
