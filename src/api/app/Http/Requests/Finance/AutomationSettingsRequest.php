<?php

namespace App\Http\Requests\Finance;

use Illuminate\Foundation\Http\FormRequest;

class AutomationSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Role, activity, consent, and management permissions are route middleware.
    }

    public function rules(): array
    {
        $rules = ['collection_time' => ['sometimes', 'date_format:H:i']];
        if ($this->user()->role->value === 'admin') {
            foreach (['cod_deadline_hours', 'seller_delay_hours', 'logistics_delay_hours'] as $field) {
                $rules[$field] = ['sometimes', 'integer', 'between:1,8760'];
            }
            foreach (['seller_payout_time', 'logistics_payout_time'] as $field) {
                $rules[$field] = ['sometimes', 'date_format:H:i'];
            }
            foreach (['collection_enabled', 'seller_payout_enabled', 'logistics_payout_enabled'] as $field) {
                $rules[$field] = ['sometimes', 'boolean'];
            }
        }

        return $rules;
    }
}
