<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SendConversationMessageRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('body')) || $this->input('body') === null) {
            $this->merge(['body' => trim((string) $this->input('body', ''))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'body' => ['required_without:attachment_ids', 'nullable', 'string', 'max:2000'],
            'attachment_ids' => ['sometimes', 'array', 'list', 'max:5'],
            'attachment_ids.*' => ['required', 'uuid', 'distinct'],
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
