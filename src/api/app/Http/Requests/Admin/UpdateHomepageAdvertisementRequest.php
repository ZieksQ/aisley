<?php

namespace App\Http\Requests\Admin;

class UpdateHomepageAdvertisementRequest extends StoreHomepageAdvertisementRequest
{
    public function rules(): array { return ['revision' => ['required', 'integer', 'min:1'], ...parent::rules()]; }
}
