<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserRole;
use App\Services\Notifications\NotificationCategoryCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListNotificationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', Rule::in(['all', 'unread', 'read'])],
            'type' => ['sometimes', Rule::in([
                'account-registration.pending',
                'support-ticket.created',
                'support-ticket.requester-replied',
                'support-ticket.admin-replied',
                'support-ticket.status-changed',
            ])],
            'category' => ['sometimes', Rule::in(['all', ...app(NotificationCategoryCatalog::class)->keys(UserRole::Admin)])],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ];
    }
}
