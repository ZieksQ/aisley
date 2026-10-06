<?php

namespace App\Enums;

enum ChatAttachmentState: string
{
    case Pending = 'pending';
    case Ready = 'ready';
    case Rejected = 'rejected';
    case Failed = 'failed';
    case Deleted = 'deleted';
}
