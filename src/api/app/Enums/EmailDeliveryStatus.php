<?php

namespace App\Enums;

enum EmailDeliveryStatus: string
{
    case Pending = 'pending';
    case Queued = 'queued';
    case Sending = 'sending';
    case Accepted = 'accepted';
    case Failed = 'failed';
    case Skipped = 'skipped';
}
