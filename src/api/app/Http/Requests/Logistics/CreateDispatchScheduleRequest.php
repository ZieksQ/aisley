<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class CreateDispatchScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'shipment_ids' => ['required', 'array', 'min:1', 'max:15'],
            'shipment_ids.*' => ['required', 'uuid', 'distinct'],
            'courier_id' => ['required', 'uuid'],
            'scheduled_for' => ['required', 'date', 'after_or_equal:now'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if (! Str::isUuid((string) $this->header('Idempotency-Key'))) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key header is required.');
            }
        }];
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
    }
}
