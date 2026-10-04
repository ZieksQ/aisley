<?php

namespace App\Http\Requests\Finance;

use Illuminate\Foundation\Http\FormRequest;

class PayoutSelectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Role, activity, consent, and management permissions are route middleware.
    }

    public function rules(): array
    {
        return ['beneficiary_type' => ['required', 'in:seller,logistics'], 'beneficiary_id' => ['required', 'uuid'], 'order_ids' => ['required', 'array', 'min:1', 'max:500'], 'order_ids.*' => ['required', 'uuid', 'distinct'], 'idempotency_key' => ['required', 'uuid'], 'early' => ['sometimes', 'boolean']];
    }
}
