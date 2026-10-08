<?php

namespace App\Enums;

enum VoucherVersionState: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Discarded = 'discarded';
}
