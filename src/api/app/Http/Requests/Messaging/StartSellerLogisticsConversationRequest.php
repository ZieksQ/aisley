<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Validation\Rule;

class StartSellerLogisticsConversationRequest extends OperationalMessageRequest
{
    public function rules(): array
    {
        return [...parent::rules(), 'context_type' => ['required', Rule::in(['pickup_request'])], 'context_id' => ['required', 'uuid']];
    }

    protected function acceptedFields(): array
    {
        return ['body', 'context_type', 'context_id'];
    }
}
