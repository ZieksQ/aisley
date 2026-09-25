<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Support\SupportTicketMutationRequest;

class ClaimSupportTicketRequest extends SupportTicketMutationRequest
{
    public function rules(): array
    {
        return ['expected_revision' => ['required', 'integer', 'min:1']];
    }

    protected function acceptedFields(): array
    {
        return ['expected_revision'];
    }
}
