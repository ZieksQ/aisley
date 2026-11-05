<?php

namespace App\Support\Admin;

use Illuminate\Validation\Rules\Password;

class PasswordPolicy
{
    public static function rule(): Password
    {
        return Password::min(8)->mixedCase()->numbers();
    }
}
