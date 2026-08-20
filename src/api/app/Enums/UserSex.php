<?php

namespace App\Enums;

enum UserSex: string
{
    //
    case MALE = 'male';
    case FEMALE = 'female';
    case OTHER = 'other';
    case UNKNOWN = 'unknown';
}
