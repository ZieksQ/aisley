<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Validation\Rule;

class StartOperationalConversationRequest extends OperationalMessageRequest
{
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'task_id' => [$this->input('context_type') ? 'prohibited' : 'required', 'uuid'],
            'leg' => [$this->input('context_type') ? 'prohibited' : 'required', Rule::in(['first_mile', 'final_mile'])],
            'context_type' => [$this->routeIs('courier.*') ? 'prohibited' : 'sometimes', Rule::in(['order', 'pickup_request'])],
            'context_id' => [$this->input('context_type') ? 'required' : 'prohibited', 'uuid'],
            'counterparty_role' => [$this->routeIs('courier.*') ? 'required' : 'prohibited', Rule::in(['logistics', 'seller', 'customer'])],
        ];
    }

    protected function acceptedFields(): array
    {
        return ['body', 'task_id', 'leg', 'context_type', 'context_id', 'counterparty_role'];
    }
}
