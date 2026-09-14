<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;

class BulkReceiveAtHubRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'receipts' => ['required', 'array', 'min:1', 'max:100'],
            'receipts.*.client_id' => ['required', 'uuid', 'distinct'],
            'receipts.*.reference' => ['required', 'string', 'max:128', 'distinct:ignore_case'],
            'receipts.*.scanned_at' => ['required', 'date'],
        ];
    }
}
