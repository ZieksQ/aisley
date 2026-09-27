<?php

namespace App\Http\Requests\Logistics;

use App\Enums\LogisticsServiceType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRateCardRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'currency' => ['sometimes', Rule::in(['PHP'])],
            'effective_at' => ['required', 'date'],
            'rules' => ['required', 'array', 'min:1', 'max:1000'],
            'rules.*.category_id' => ['required', 'uuid', 'exists:categories,id'],
            'rules.*.service_type' => ['required', Rule::enum(LogisticsServiceType::class)],
            'rules.*.base_charge_cents' => ['required', 'integer', 'min:0'],
            'rules.*.included_weight_grams' => ['required', 'integer', 'min:1', 'max:100000000'],
            'rules.*.additional_weight_grams' => ['required', 'integer', 'min:1', 'max:100000000'],
            'rules.*.additional_fee_cents' => ['required', 'integer', 'min:0'],
            'rules.*.max_weight_grams' => ['required', 'integer', 'min:1', 'max:100000000'],
            'rules.*.max_length_mm' => ['required', 'integer', 'min:1', 'max:100000'],
            'rules.*.max_width_mm' => ['required', 'integer', 'min:1', 'max:100000'],
            'rules.*.max_height_mm' => ['required', 'integer', 'min:1', 'max:100000'],
        ];
    }
}
