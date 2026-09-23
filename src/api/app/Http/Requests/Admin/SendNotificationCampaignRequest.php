<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SendNotificationCampaignRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'revision' => ['required', 'integer', 'min:1'],
            'confirmation' => ['required', 'accepted'],
            'idempotency_key' => ['prohibited'],
        ];
    }

    public function idempotencyKey(): string
    {
        $key = (string) $this->header('Idempotency-Key', '');
        if (preg_match('/^[A-Za-z0-9_-]{8,128}$/', $key) !== 1) {
            abort(422, 'Provide a valid Idempotency-Key header.');
        }

        return $key;
    }
}
