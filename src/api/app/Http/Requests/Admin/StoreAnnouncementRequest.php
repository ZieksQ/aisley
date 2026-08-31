<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreAnnouncementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:160'],
            'body' => ['required', 'string', 'max:20000', 'not_regex:/<[^>]+>/'],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'status' => ['prohibited'],
            'created_by_admin_id' => ['prohibited'],
        ];
    }
}
