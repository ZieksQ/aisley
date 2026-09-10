<?php

namespace App\Http\Requests\Policy;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class AcceptPolicyRequest extends FormRequest
{
    private const ALLOWED_FIELDS = ['confirmation'];

    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        return [
            'confirmation' => ['required', 'accepted'],
            'user_id' => ['prohibited'],
            'role' => ['prohibited'],
            'policy_id' => ['prohibited'],
            'accepted_at' => ['prohibited'],
        ];
    }

    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), self::ALLOWED_FIELDS) as $field) {
                $validator->errors()->add($field, 'This field is not accepted.');
            }
        });
    }
}
