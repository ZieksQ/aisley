<?php

namespace App\Http\Requests\Admin;

class UpdatePolicyVersionRequest extends StorePolicyVersionRequest
{
    public function rules(): array
    {
        return [...parent::rules(), 'revision' => ['required', 'integer', 'min:1']];
    }
}
