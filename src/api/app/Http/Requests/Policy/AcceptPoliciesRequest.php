<?php

namespace App\Http\Requests\Policy;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class AcceptPoliciesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'acceptances' => ['required', 'array', 'list', 'min:1', 'max:2'],
            'acceptances.*' => ['required', 'array:type,version,confirmation'],
            'acceptances.*.type' => ['required', 'string', 'in:terms_of_service,privacy_policy', 'distinct:strict'],
            'acceptances.*.version' => ['required', 'integer', 'min:1'],
            'acceptances.*.confirmation' => ['required', 'boolean', function (string $attribute, mixed $value, \Closure $fail): void {
                if ($value !== true) {
                    $fail('Explicit confirmation is required.');
                }
            }],
        ];
    }

    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['acceptances']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted.');
            }
        });
    }
}
