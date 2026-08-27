<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

class ProductSearchRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('q')) {
            $this->merge(['q' => trim((string) $this->input('q'))]);
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
            'q' => ['required', 'string', 'min:1', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'limit' => ['sometimes', 'integer', 'min:8', 'max:50'],
        ];
    }

    public function queryText(): string
    {
        return (string) $this->validated('q');
    }

    public function pageSize(): int
    {
        return (int) $this->validated('limit', 20);
    }
}
