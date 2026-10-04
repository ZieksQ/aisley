<?php

namespace App\Http\Requests\Finance;

use Illuminate\Foundation\Http\FormRequest;

class PaymentSelectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Role, activity, consent, and management permissions are route middleware.
    }

    public function rules(): array
    {
        return ['invoice_ids' => ['required', 'array', 'min:1', 'max:500'], 'invoice_ids.*' => ['required', 'uuid', 'distinct'], 'idempotency_key' => ['required', 'uuid']];
    }
}
