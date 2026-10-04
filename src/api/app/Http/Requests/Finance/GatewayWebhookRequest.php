<?php

namespace App\Http\Requests\Finance;

use Illuminate\Foundation\Http\FormRequest;

class GatewayWebhookRequest extends FormRequest
{
    public function authorize(): bool
    {
        abort_unless(config('finance.gateway_enabled'), 404);
        abort_if(strlen($this->getContent()) > 16384, 413);
        preg_match('/^t=(\d+),v1=([a-f0-9]{64})$/', (string) $this->header('X-Gateway-Signature'), $parts);
        abort_unless(count($parts) === 3 && abs(now()->timestamp - (int) $parts[1]) <= 300
            && hash_equals(hash_hmac('sha256', $parts[1].'.'.$this->getContent(), config('finance.webhook_secret')), $parts[2]), 400, 'Invalid gateway signature.');

        return true;
    }

    public function rules(): array
    {
        return ['id' => ['required', 'uuid'], 'type' => ['required', 'in:collection.succeeded,collection.failed,payout.succeeded,payout.failed'],
            'livemode' => ['required', 'boolean'], 'data' => ['required', 'array'],
            'data.id' => ['required', 'uuid'], 'data.direction' => ['required', 'in:collection,payout'],
            'data.status' => ['required', 'in:succeeded,failed'], 'data.amount_cents' => ['required', 'integer', 'min:1'],
            'data.currency' => ['required', 'in:PHP'], 'data.account_reference' => ['required', 'string', 'max:120'],
            'data.livemode' => ['required', 'boolean'], 'data.metadata.attempt_id' => ['required', 'uuid']];
    }
}
