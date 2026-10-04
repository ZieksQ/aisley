<?php

namespace App\Http\Requests\Finance;

use Illuminate\Foundation\Http\FormRequest;

class GatewayPaymentRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['idempotency_key' => $this->header('Idempotency-Key')]);
    }

    public function authorize(): bool
    {
        return config('finance.gateway_enabled') && hash_equals((string) config('finance.gateway_key'), (string) $this->bearerToken());
    }

    public function rules(): array
    {
        return ['idempotency_key' => ['required', 'string', 'max:200'], 'direction' => ['required', 'in:collection,payout'],
            'amount_cents' => ['required', 'integer', 'between:1,100000000000'], 'currency' => ['required', 'in:PHP'],
            'account_reference' => ['required', 'string', 'max:120', 'not_in:platform'],
            'metadata' => ['required', 'array:attempt_id'], 'metadata.attempt_id' => ['required', 'uuid']];
    }
}
