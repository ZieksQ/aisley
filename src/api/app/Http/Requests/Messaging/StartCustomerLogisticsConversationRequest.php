<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Validation\Rule;

class StartCustomerLogisticsConversationRequest extends OperationalMessageRequest
{
    public function rules(): array
    {
        return [...parent::rules(), 'context_type' => ['required', Rule::in(['order'])], 'context_id' => ['required', 'uuid']];
    }

    protected function acceptedFields(): array
    {
        return ['body', 'context_type', 'context_id'];
    }
}
