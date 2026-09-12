<?php

namespace App\Http\Requests\Logistics;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateHubLocationRequest extends FormRequest
{
    private const ALLOWED_FIELDS = [
        'latitude',
        'longitude',
        'expected_updated_at',
        'reason',
    ];

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'latitude' => [
                'required',
                'numeric',
                'between:-90,90',
                $this->finiteCoordinate('latitude'),
            ],
            'longitude' => [
                'required',
                'numeric',
                'between:-180,180',
                $this->finiteCoordinate('longitude'),
            ],
            'expected_updated_at' => ['required', 'string', 'max:64'],
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
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
        $this->merge($normalized);
    }

    private function finiteCoordinate(string $field): Closure
    {
        return static function (string $attribute, mixed $value, Closure $fail) use ($field): void {
            if (! is_numeric($value) || ! is_finite((float) $value)) {
                $fail("The {$field} must be a finite number.");
            }
        };
    }
}
