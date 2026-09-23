<?php

namespace App\Http\Requests\Messaging;

class StartConversationRequest extends SendConversationMessageRequest
{
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'shop_id' => ['required', 'uuid'],
        ];
    }
}
