<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Validation\Rule;

class StartOperationalConversationRequest extends OperationalMessageRequest
{
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'task_id' => [$this->input('context_type') === 'order' ? 'prohibited' : 'required', 'uuid'],
            'leg' => [$this->input('context_type') === 'order' ? 'prohibited' : 'required', Rule::in(['first_mile', 'final_mile'])],
            'context_type' => [$this->routeIs('courier.*') ? 'prohibited' : 'sometimes', Rule::in(['order'])],
            'context_id' => [$this->input('context_type') === 'order' ? 'required' : 'prohibited', 'uuid'],
            'counterparty_role' => [$this->routeIs('courier.*') ? 'required' : 'prohibited', Rule::in(['logistics'])],
        ];
    }

    protected function acceptedFields(): array
    {
        return ['body', 'task_id', 'leg', 'context_type', 'context_id', 'counterparty_role'];
    }
}
