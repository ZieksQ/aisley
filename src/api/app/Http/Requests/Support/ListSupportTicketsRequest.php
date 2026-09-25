<?php

namespace App\Http\Requests\Support;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListSupportTicketsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'cursor' => ['sometimes', 'string', 'max:2048'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'status' => ['sometimes', Rule::in(['open', 'in_progress', 'waiting_for_requester', 'resolved'])],
            'category' => ['sometimes', Rule::in(['general', 'account', 'order', 'delivery'])],
            'assignee' => ['sometimes', Rule::in(['mine', 'unassigned', 'all'])],
        ];
    }
}
