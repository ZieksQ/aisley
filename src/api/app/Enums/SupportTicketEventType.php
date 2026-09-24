<?php

namespace App\Enums;

enum SupportTicketEventType: string
{
    case Reply = 'reply';
    case Status = 'status';
    case Assignment = 'assignment';
}
