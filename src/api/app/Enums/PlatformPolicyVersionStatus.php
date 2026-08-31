<?php

namespace App\Enums;

enum PlatformPolicyVersionStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Superseded = 'superseded';
}
