<?php

namespace App\Http\Requests\Admin;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\Admin\AuditTargetType;
use App\Enums\AdminAuditAction;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListAuditLogsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'actor_id' => ['sometimes', 'uuid'],
            'source_feature' => ['sometimes', Rule::enum(AuditSourceFeature::class)],
            'action' => ['sometimes', Rule::enum(AdminAuditAction::class)],
            'target_type' => ['sometimes', Rule::enum(AuditTargetType::class)],
            'target_id' => ['sometimes', 'uuid'],
            'search' => ['sometimes', 'string', 'max:255'],
            'from' => ['sometimes', 'date'],
            'to' => ['sometimes', 'date', 'after_or_equal:from'],
            'sort' => ['sometimes', Rule::in(['newest', 'oldest'])],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
