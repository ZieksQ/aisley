<?php

namespace App\Http\Requests\Finance;

use Illuminate\Foundation\Http\FormRequest;

class CollectorReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Role, activity, consent, and management permissions are route middleware.
    }

    public function rules(): array
    {
        return ['logistics_organization_id' => ['required', 'uuid', 'exists:logistics_organizations,id'], 'reason' => ['required', 'string', 'max:2000']];
    }
}
