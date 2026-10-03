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
            'services' => ['required', 'array', 'min:1', 'max:3'],
            'services.*' => ['array:service_type,base_fee_cents'],
            'services.*.service_type' => ['required', Rule::enum(LogisticsServiceType::class), 'distinct'],
            'services.*.base_fee_cents' => ['required', 'integer', 'min:0'],
            'rules' => ['required', 'array', 'min:1', 'max:1000'],
            'rules.*.category_id' => ['required', 'uuid', 'exists:categories,id'],
            'rules.*.service_type' => ['required', Rule::enum(LogisticsServiceType::class)],
            'rules.*.base_charge_cents' => ['prohibited'],
            'rules.*.included_weight_grams' => ['required', 'integer', 'min:1', 'max:100000000'],
            'rules.*.additional_weight_grams' => ['required', 'integer', 'min:1', 'max:100000000'],
            'rules.*.additional_fee_cents' => ['required', 'integer', 'min:0'],
            'rules.*.max_weight_grams' => ['required', 'integer', 'min:1', 'max:100000000'],
            'rules.*.max_length_mm' => ['required', 'integer', 'min:1', 'max:100000'],
            'rules.*.max_width_mm' => ['required', 'integer', 'min:1', 'max:100000'],
            'rules.*.max_height_mm' => ['required', 'integer', 'min:1', 'max:100000'],
        ];
    }

    public function after(): array
    {
        return [function ($validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $pairs = collect($this->input('rules'))->map(fn (array $rule) => $rule['category_id'].':'.$rule['service_type']);
            if ($pairs->unique()->count() !== $pairs->count()) {
                $validator->errors()->add('rules', 'Each category and service type may appear only once.');
            }
            $serviceTypes = collect($this->input('services'))->pluck('service_type')->sort()->values();
            $ruleTypes = collect($this->input('rules'))->pluck('service_type')->unique()->sort()->values();
            if ($serviceTypes->all() !== $ruleTypes->all()) {
                $validator->errors()->add('services', 'Every offered service needs a base fee and at least one category rule.');
            }
        }];
    }
}
