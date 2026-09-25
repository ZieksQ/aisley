<?php

namespace App\Http\Requests\Support;

use Illuminate\Validation\Rule;

class CreateSupportTicketRequest extends SupportTicketMutationRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['subject', 'body'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string', 'min:1', 'max:150'],
            'category' => ['required', Rule::in(['general', 'account', 'order', 'delivery'])],
            'body' => ['required', 'string', 'min:1', 'max:2000'],
            'context_type' => ['prohibited'],
            'context_id' => ['prohibited'],
        ];
    }

    protected function acceptedFields(): array
    {
        return ['subject', 'category', 'body'];
    }
}
