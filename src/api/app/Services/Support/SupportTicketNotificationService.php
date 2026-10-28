<?php

namespace App\Services\Support;

use App\Jobs\Support\DeliverSupportTicketNotification;
use App\Models\SupportTicket;
use App\Models\SupportTicketEvent;
use Illuminate\Support\Facades\DB;
use Throwable;

class SupportTicketNotificationService
{
    public function queue(SupportTicket $ticket, SupportTicketEvent $event, string $type): void
    {
        if (! in_array($type, SupportTicketNotificationPresenter::TYPES, true)) {
            return;
        }

        $ticketId = (string) $ticket->id;
        $eventId = (string) $event->id;

        try {
            DB::afterCommit(function () use ($ticketId, $eventId, $type): void {
                try {
                    DeliverSupportTicketNotification::dispatch($ticketId, $eventId, $type)->afterCommit();
                } catch (Throwable $exception) {
                    report($exception);
                    try {
                        DeliverSupportTicketNotification::dispatchSync($ticketId, $eventId, $type);
                    } catch (Throwable $fallback) {
                        report($fallback);
                    }
                }
            });
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
