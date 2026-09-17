<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class HubRoutingConfigurationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('postal_code')) {
            $this->merge(['postal_code' => preg_replace('/[\s-]+/', '', trim((string) $this->input('postal_code')))]);
        }
    }

    public function rules(): array
    {
        if ($this->isMethod('PATCH')) {
            return ['expected_revision' => ['required', 'integer', 'min:1'], 'is_active' => ['required', 'boolean']];
        }
        $fields = $this->route('kind') === 'service-areas'
            ? ['logistics_hub_id' => ['required', 'uuid'], 'postal_code' => ['required', 'string', 'regex:/^\d{4}$/']]
            : ['from_hub_id' => ['required', 'uuid'], 'to_hub_id' => ['required', 'uuid', 'different:from_hub_id']];

        return [...$fields, 'is_active' => ['sometimes', 'boolean']];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), array_keys($this->rules())) as $field) {
                $validator->errors()->add($field, 'This configuration field is not accepted.');
            }
        }];
    }
}
