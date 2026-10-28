<?php

namespace App\Http\Requests\Seller;

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

    public function rules(): array
    {
        return [
            'status' => ['nullable', 'in:all,unread,read'],
            'category' => ['sometimes', Rule::in(['all', ...app(NotificationCategoryCatalog::class)->keys(UserRole::Seller)])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }
}
