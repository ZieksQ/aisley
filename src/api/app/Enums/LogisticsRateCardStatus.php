<?php

namespace App\Enums;

enum LogisticsRateCardStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
    case Archived = 'archived';
}
