<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class MarkNotificationReadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_keys($this->request->all()) as $field) {
                $validator->errors()->add($field, "The {$field} field is not supported.");
            }

            foreach (array_keys($this->query()) as $field) {
                $validator->errors()->add($field, "The {$field} query parameter is not supported.");
            }
        }];
    }
}
