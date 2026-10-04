<?php

namespace App\Http\Requests\Finance;

use App\Enums\GatewayScenario;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SandboxAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Role, activity, consent, and management permissions are route middleware.
    }

    public function rules(): array
    {
        return ['reference' => ['required', 'string', 'max:120', 'not_in:platform'], 'balance_cents' => ['required', 'integer', 'between:0,100000000000'], 'scenario' => ['required', Rule::enum(GatewayScenario::class)], 'is_active' => ['required', 'boolean']];
    }
}
