<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Validation\Rule;

class StartOperationalConversationRequest extends OperationalMessageRequest
{
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'task_id' => ['required', 'uuid'],
            'leg' => ['required', Rule::in(['first_mile', 'final_mile'])],
            'counterparty_role' => [$this->routeIs('courier.*') ? 'required' : 'prohibited', Rule::in(['logistics'])],
        ];
    }

    protected function acceptedFields(): array
    {
        return ['body', 'task_id', 'leg', 'counterparty_role'];
    }
}
