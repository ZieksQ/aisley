<?php

namespace App\Http\Requests\Courier;

use App\Enums\VehicleType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateVehicleRequest extends FormRequest
{
    private const ALLOWED_FIELDS = ['expected_revision', 'vehicle_type', 'plate_number', 'make', 'model'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'vehicle_type' => ['sometimes', Rule::enum(VehicleType::class)],
            'plate_number' => ['sometimes', 'string', 'max:64'],
            'make' => ['sometimes', 'nullable', 'string', 'max:255'],
            'model' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }

    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), self::ALLOWED_FIELDS) as $field) {
                $validator->errors()->add($field, 'This field is not allowed.');
            }

            if (count(array_intersect(array_keys($this->all()), ['vehicle_type', 'plate_number', 'make', 'model'])) === 0) {
                $validator->errors()->add('vehicle', 'At least one vehicle field must be supplied.');
            }
            if (! Str::isUuid((string) $this->header('Idempotency-Key'))) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key header is required.');
            }
        });
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
    }
}
