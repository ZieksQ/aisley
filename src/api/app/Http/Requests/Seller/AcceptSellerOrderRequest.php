<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class AcceptSellerOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['status' => ['prohibited']];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
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
