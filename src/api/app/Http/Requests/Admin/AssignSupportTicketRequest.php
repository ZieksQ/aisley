<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Support\SupportTicketMutationRequest;

class AssignSupportTicketRequest extends SupportTicketMutationRequest
{
    public function rules(): array
    {
        return [
            'assignee_id' => ['present', 'nullable', 'uuid'],
            'expected_revision' => ['required', 'integer', 'min:1'],
        ];
    }

    protected function acceptedFields(): array
    {
        return ['assignee_id', 'expected_revision'];
    }
}
