<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class DecideCourierApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $isReject = $this->route('decision') === 'reject';

        return [
            'reason' => [$isReject ? 'required' : 'sometimes', 'nullable', 'string', 'min:3', 'max:2000'],
        ];
    }

    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['reason']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for a Courier application decision.');
            }
        });
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('reason')) {
            $this->merge(['reason' => trim((string) $this->input('reason'))]);
        }
    }
}
