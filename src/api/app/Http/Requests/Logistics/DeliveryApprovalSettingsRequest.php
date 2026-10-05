<?php

namespace App\Http\Requests\Logistics;

use App\Enums\DeliveryApprovalMode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DeliveryApprovalSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['mode' => ['required', Rule::enum(DeliveryApprovalMode::class)]];
    }
}
