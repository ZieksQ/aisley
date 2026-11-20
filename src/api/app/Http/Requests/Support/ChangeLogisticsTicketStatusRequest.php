<?php

namespace App\Http\Requests\Support;

use App\Enums\UserRole;
use Illuminate\Validation\Rule;

class ChangeLogisticsTicketStatusRequest extends SupportTicketMutationRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === UserRole::Logistics;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $this->merge(['reason' => trim($this->input('reason'))]);
        }
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['open', 'resolved'])],
            'reason' => ['required', 'string', 'min:1', 'max:2000'],
            'expected_revision' => ['required', 'integer', 'min:1'],
        ];
    }

    protected function acceptedFields(): array
    {
        return ['status', 'reason', 'expected_revision'];
    }
}
