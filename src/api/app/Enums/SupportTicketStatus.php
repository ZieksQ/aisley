<?php

namespace App\Enums;

enum SupportTicketStatus: string
{
    case Open = 'open';
    case InProgress = 'in_progress';
    case WaitingForRequester = 'waiting_for_requester';
    case Resolved = 'resolved';
}
