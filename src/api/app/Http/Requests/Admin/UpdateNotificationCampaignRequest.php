<?php

namespace App\Http\Requests\Admin;

class UpdateNotificationCampaignRequest extends StoreNotificationCampaignRequest
{
    public function rules(): array
    {
        return [...parent::rules(), 'revision' => ['required', 'integer', 'min:1']];
    }
}
