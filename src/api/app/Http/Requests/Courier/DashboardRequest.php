<?php

namespace App\Http\Requests\Courier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class DashboardRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['version' => ['sometimes', 'integer', 'in:1,2']];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['version']) as $field) {
                $validator->errors()->add($field, 'This dashboard field is not supported.');
            }
        }];
    }
}
