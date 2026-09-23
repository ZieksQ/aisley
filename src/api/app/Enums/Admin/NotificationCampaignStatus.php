<?php

namespace App\Enums\Admin;

enum NotificationCampaignStatus: string
{
    case Draft = 'draft';
    case Preparing = 'preparing';
    case Queued = 'queued';
    case Sending = 'sending';
    case Completed = 'completed';
    case PartiallyFailed = 'partially_failed';
    case Failed = 'failed';
}
