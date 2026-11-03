<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListChatInboxRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $roles = array_diff(['customer', 'seller', 'logistics', 'courier'], [$this->user()->role->value]);

        return ['cursor' => ['sometimes', 'string', 'max:2048'],
            'counterparty_role' => ['sometimes', Rule::in($roles)]];
    }
}
