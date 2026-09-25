<?php

namespace App\Http\Requests\Support;

class ReplySupportTicketRequest extends SupportTicketMutationRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('body'))) {
            $this->merge(['body' => trim($this->input('body'))]);
        }
    }

    public function rules(): array
    {
        return ['body' => ['required', 'string', 'min:1', 'max:2000'], 'expected_revision' => ['required', 'integer', 'min:1']];
    }

    protected function acceptedFields(): array
    {
        return ['body', 'expected_revision'];
    }
}
