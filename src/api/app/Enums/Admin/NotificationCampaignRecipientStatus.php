<?php

namespace App\Enums\Admin;

enum NotificationCampaignRecipientStatus: string
{
    case Pending = 'pending';
    case Delivered = 'delivered';
    case Skipped = 'skipped';
    case Failed = 'failed';
}
