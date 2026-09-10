<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ListProductQuestionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'in:all,unanswered,answered'],
            'product' => ['sometimes', 'string', 'max:120'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->query()), ['status', 'product', 'page', 'per_page']) as $field) {
                $validator->errors()->add($field, 'This filter is not accepted for Product questions.');
            }
        }];
    }

    public function pageSize(): int
    {
        return (int) $this->validated('per_page', 20);
    }
}
