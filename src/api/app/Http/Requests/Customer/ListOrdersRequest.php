<?php

namespace App\Http\Requests\Customer;

use App\Enums\Customer\CustomerOrderGroup;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListOrdersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'group' => ['sometimes', 'string', Rule::enum(CustomerOrderGroup::class)],
            'page' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }

    public function group(): ?CustomerOrderGroup
    {
        $value = $this->validated('group');

        return is_string($value) ? CustomerOrderGroup::from($value) : null;
    }

    public function pageSize(): int
    {
        return (int) $this->validated('per_page', 15);
    }
}
