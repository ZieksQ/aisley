<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ShopProductsRequest extends FormRequest
{
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
            'category' => ['sometimes', 'string', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'limit' => ['sometimes', 'integer', 'min:8', 'max:50'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $unknown = array_diff(array_keys($this->query()), ['category', 'page', 'limit']);

            foreach ($unknown as $key) {
                $validator->errors()->add($key, "The {$key} parameter is not supported.");
            }
        }];
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
