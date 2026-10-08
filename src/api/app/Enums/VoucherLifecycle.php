<?php

namespace App\Enums;

enum VoucherLifecycle: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Ended = 'ended';
}
