<?php

namespace App\Enums;

enum UserSex: string
{
    case Male = 'male';
    case Female = 'female';
    case NonBinary = 'non_binary';
    case PreferNotToSay = 'prefer_not_to_say';
}
