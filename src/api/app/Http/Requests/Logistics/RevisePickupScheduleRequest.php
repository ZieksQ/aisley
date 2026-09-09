<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RevisePickupScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:1000'],
            'courier_id' => ['sometimes', 'uuid'],
            'starts_at' => ['sometimes', 'date', 'after:now'],
            'ends_at' => ['sometimes', 'date'],
            'organization_id' => ['prohibited'], 'hub_id' => ['prohibited'], 'status' => ['prohibited'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if (! $this->hasAny(['courier_id', 'starts_at', 'ends_at'])) {
                $validator->errors()->add('schedule', 'At least one schedule field must be changed.');
            }
        }];
    }
}
