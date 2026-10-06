<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class UploadChatAttachmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['file' => ['required', 'file', 'max:30720'], 'context' => ['required', 'json', 'max:4096']];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if (! Str::isUuid((string) $this->header('Idempotency-Key'))) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key header is required.');
            }
        }];
    }
}
