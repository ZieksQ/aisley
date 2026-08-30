<?php

namespace App\Http\Requests\Seller;

use App\Enums\InventoryMovementType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdjustInventoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'movement_type' => ['required', Rule::enum(InventoryMovementType::class)->only([
                InventoryMovementType::Restock,
                InventoryMovementType::ManualIncrease,
                InventoryMovementType::ManualDecrease,
                InventoryMovementType::ReturnIn,
            ])],
            'quantity' => ['required', 'integer', 'min:1', 'max:999999999'],
            'reason' => ['required', 'string', 'max:500'],
            'idempotency_key' => ['nullable', 'string', 'max:120'],
        ];
    }
}
