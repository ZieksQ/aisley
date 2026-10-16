<?php

namespace App\Http\Requests\Account;

class PasswordChangeCodeRequest extends PasswordChangeRequest
{
    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['challenge_id'], $rules['verification_code']);

        return $rules;
    }
}
