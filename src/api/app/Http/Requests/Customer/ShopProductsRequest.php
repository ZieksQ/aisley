<?php

namespace App\Http\Requests\Customer;

use App\Support\ScalarQueryParameters;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ShopProductsRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('q'))) {
            $this->merge(['q' => trim($this->input('q'))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'q' => ['sometimes', 'nullable', 'string', 'max:100'],
            'category' => ['sometimes', 'string', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'limit' => ['sometimes', 'integer', 'min:8', 'max:50'],
        ];
    }

    public function after(): array
    {
        return [fn (Validator $validator) => ScalarQueryParameters::validate($this, $validator, ['q', 'category', 'page', 'limit'])];
    }

    public function queryText(): ?string
    {
        $value = $this->validated('q');

        return is_string($value) && $value !== '' ? $value : null;
    }

    public function categorySlug(): ?string
    {
        $value = $this->validated('category');

        return is_string($value) ? $value : null;
    }

    public function pageSize(): int
    {
        return (int) $this->validated('limit', 20);
    }
}
