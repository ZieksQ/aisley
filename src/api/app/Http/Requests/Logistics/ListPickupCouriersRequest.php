<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ListPickupCouriersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'starts_at' => ['sometimes', 'date', 'after:now'],
            'ends_at' => ['sometimes', 'date', 'after:starts_at'],
            'exclude_schedule_id' => ['sometimes', 'uuid'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($this->has('starts_at') !== $this->has('ends_at')) {
                $validator->errors()->add('schedule_window', 'Both starts_at and ends_at are required to check Courier availability.');
            }
        }];
    }
}
