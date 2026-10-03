<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreShippingRateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'currency' => ['sometimes', Rule::in(['PHP'])],
            'base_fee_cents' => ['prohibited'],
            'volumetric_divisor' => ['prohibited'],
            'max_weight_grams' => ['prohibited'],
            'max_length_mm' => ['prohibited'],
            'max_width_mm' => ['prohibited'],
            'max_height_mm' => ['prohibited'],
            'included_weight_grams' => ['prohibited'],
            'additional_weight_grams' => ['prohibited'],
            'additional_fee_cents' => ['prohibited'],
            'destination_surcharge_cents' => ['prohibited'],
            'region_surcharges' => ['present', 'array', 'max:50'],
            'region_surcharges.*' => ['array:region,surcharge_cents'],
            'region_surcharges.*.region' => ['required', 'string', 'max:255'],
            'region_surcharges.*.surcharge_cents' => ['required', 'integer', 'min:0'],
            'effective_at' => ['required', 'date'],
        ];
    }

    public function after(): array
    {
        return [function ($validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $regions = collect($this->input('region_surcharges'));
            if ($regions->map(fn (array $item) => mb_strtolower(trim($item['region'])))->unique()->count() !== $regions->count()) {
                $validator->errors()->add('region_surcharges', 'Each destination region may appear only once.');
            }
        }];
    }
}
