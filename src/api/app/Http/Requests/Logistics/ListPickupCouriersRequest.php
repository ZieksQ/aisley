<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;

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
}
