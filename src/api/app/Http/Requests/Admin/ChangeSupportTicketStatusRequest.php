<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Support\SupportTicketMutationRequest;
use Illuminate\Validation\Rule;

class ChangeSupportTicketStatusRequest extends SupportTicketMutationRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $this->merge(['reason' => trim($this->input('reason'))]);
        }
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['open', 'in_progress', 'waiting_for_requester', 'resolved'])],
            'reason' => ['nullable', 'string', 'min:1', 'max:2000'],
            'expected_revision' => ['required', 'integer', 'min:1'],
        ];
    }

    protected function acceptedFields(): array
    {
        return ['status', 'reason', 'expected_revision'];
    }
}
