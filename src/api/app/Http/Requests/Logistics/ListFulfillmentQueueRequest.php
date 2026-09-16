<?php

namespace App\Http\Requests\Logistics;

use App\Enums\ShipmentEvidenceStatus;
use App\Enums\ShipmentStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListFulfillmentQueueRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', Rule::enum(ShipmentStatus::class)],
            'evidence_status' => ['sometimes', Rule::enum(ShipmentEvidenceStatus::class)],
            'search' => ['sometimes', 'string', 'max:100'],
            'lane_id' => ['sometimes', 'string', 'regex:/^(unassigned|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:25'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:100000'],
        ];
    }
}
