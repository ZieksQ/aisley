<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreNotificationCampaignRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'title' => is_string($this->input('title')) ? trim($this->input('title')) : $this->input('title'),
            'body' => is_string($this->input('body')) ? trim($this->input('body')) : $this->input('body'),
        ]);
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:3', 'max:120', 'not_regex:/<[^>]+>/'],
            'body' => ['required', 'string', 'min:3', 'max:2000', 'not_regex:/<[^>]+>/'],
            'audience_key' => ['required', Rule::in(['opted_in_customers'])],
            'destination_type' => ['nullable', Rule::in(['product', 'shop'])],
            'destination_id' => ['required_with:destination_type', 'prohibited_unless:destination_type,product,shop', 'nullable', 'uuid'],
            'revision' => ['prohibited'],
            'status' => ['prohibited'],
            'user_ids' => ['prohibited'],
        ];
    }
}
