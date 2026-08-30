<?php

namespace App\Http\Requests\Admin;

class UpdateAnnouncementRequest extends StoreAnnouncementRequest
{
    public function rules(): array
    {
        return [...parent::rules(), 'revision' => ['required', 'integer', 'min:1']];
    }
}
