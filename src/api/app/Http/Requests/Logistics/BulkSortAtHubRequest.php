<?php

namespace App\Http\Requests\Logistics;

use App\Enums\Logistics\SortingExceptionCode;
use App\Enums\Logistics\SortingScanSource;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BulkSortAtHubRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'captures' => ['required', 'array', 'min:1', 'max:100'],
            'captures.*.client_id' => ['required', 'uuid', 'distinct'],
            'captures.*.lane_id' => ['required', 'uuid'],
            'captures.*.reference' => ['required', 'string', 'max:128', 'distinct:ignore_case'],
            'captures.*.expected_revision' => ['required', 'integer', 'min:1'],
            'captures.*.source' => ['required', Rule::enum(SortingScanSource::class)],
            'captures.*.captured_at' => ['required', 'date'],
            'captures.*.exception_code' => ['nullable', Rule::enum(SortingExceptionCode::class)],
            'captures.*.reason' => ['nullable', 'string', 'max:500'],
        ];
    }
}
