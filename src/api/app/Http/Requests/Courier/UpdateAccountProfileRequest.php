<?php

namespace App\Http\Requests\Courier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateAccountProfileRequest extends FormRequest
{
    private const ALLOWED_FIELDS = [
        'first_name',
        'middle_name',
        'last_name',
        'contact_number',
    ];

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'first_name' => ['sometimes', 'required', 'string', 'max:255'],
            'middle_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'last_name' => ['sometimes', 'required', 'string', 'max:255'],
            'contact_number' => ['sometimes', 'required', 'string', 'max:32'],
        ];
    }

    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), self::ALLOWED_FIELDS) as $field) {
                $validator->errors()->add($field, 'This field is not allowed.');
            }
        });
    }

    protected function prepareForValidation(): void
    {
        $normalized = [];

        foreach (self::ALLOWED_FIELDS as $field) {
            if (! $this->has($field)) {
                continue;
            }

            $value = $this->input($field);
            $normalized[$field] = is_string($value) ? trim($value) : $value;
        }

        if (array_key_exists('middle_name', $normalized) && $normalized['middle_name'] === '') {
            $normalized['middle_name'] = null;
        }

        $this->merge($normalized);
    }
}
