<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SendConversationMessageRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('body'))) {
            $this->merge(['body' => trim($this->input('body'))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'min:1', 'max:2000'],
            'context_type' => ['nullable', Rule::in(['product', 'order'])],
            'context_id' => ['required_with:context_type', 'prohibited_unless:context_type,product,order', 'nullable', 'uuid'],
            'sender_user_id' => ['prohibited'],
            'seller_user_id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'sent_at' => ['prohibited'],
            'attachments' => ['prohibited'],
        ];
    }

    public function idempotencyKey(): string
    {
        $key = (string) $this->header('Idempotency-Key', '');
        if (! Str::isUuid($key)) {
            abort(422, 'Provide a UUID Idempotency-Key header.');
        }

        return $key;
    }
}
