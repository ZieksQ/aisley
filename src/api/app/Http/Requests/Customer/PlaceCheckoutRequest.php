<?php

namespace App\Http\Requests\Customer;

use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class PlaceCheckoutRequest extends CheckoutQuoteRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [...parent::rules(), 'quote_id' => ['required', 'uuid']];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [...parent::after(), function (Validator $validator): void {
            $key = $this->header('Idempotency-Key');
            if (! is_string($key) || ! Str::isUuid($key)) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key header is required.');
            }
        }];
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
    }
}
