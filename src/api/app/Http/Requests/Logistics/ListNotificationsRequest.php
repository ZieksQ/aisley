<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ListNotificationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'in:all,unread,read'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->query()), ['status', 'page', 'per_page']) as $field) {
                $validator->errors()->add($field, "The {$field} notification filter is not supported.");
            }
        }];
    }

    public function pageSize(): int
    {
        return (int) $this->validated('per_page', 20);
    }
}
