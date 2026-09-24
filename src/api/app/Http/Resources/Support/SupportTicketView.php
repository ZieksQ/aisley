<?php

namespace App\Http\Resources\Support;

use App\Enums\SupportTicketEventType;
use App\Enums\UserRole;
use App\Models\SupportTicket;
use App\Models\SupportTicketEvent;
use App\Models\User;

class SupportTicketView
{
    public function summary(SupportTicket $ticket, User $viewer, int $unreadCount): array
    {
        $ticket->loadMissing(['requester.customerProfile', 'requester.sellerProfile', 'requester.logisticsProfile', 'requester.courierProfile', 'assignee.adminProfile']);

        return [
            'id' => $ticket->id,
            'reference' => $ticket->reference,
            'subject' => $ticket->subject,
            'category' => $ticket->category->value,
            'status' => $ticket->status->value,
            'revision' => $ticket->revision,
            'requester_role' => $ticket->requester_role->value,
            'requester_name' => $viewer->role === UserRole::Admin ? $this->name($ticket->requester) : null,
            'assignee_name' => $ticket->assignee ? $this->name($ticket->assignee) : null,
            'assignee_id' => $viewer->role === UserRole::Admin ? $ticket->assignee_user_id : null,
            'unread_count' => $unreadCount,
            'last_activity_at' => $ticket->last_activity_at?->toIso8601String(),
            'created_at' => $ticket->created_at?->toIso8601String(),
            'resolved_at' => $ticket->resolved_at?->toIso8601String(),
        ];
    }

    public function event(SupportTicketEvent $event, User $viewer): array
    {
        return [
            'id' => $event->id,
            'sequence' => $event->sequence,
            'type' => $event->type->value,
            'actor_role' => $event->actor_role->value,
            'is_mine' => $event->actor_user_id === $viewer->id,
            'body' => $event->body,
            'from_status' => $event->from_status?->value,
            'to_status' => $event->to_status?->value,
            'assignment_changed' => $event->type === SupportTicketEventType::Assignment,
            'created_at' => $event->created_at?->toIso8601String(),
        ];
    }

    private function name(User $user): string
    {
        $profile = match ($user->role) {
            UserRole::Admin => $user->adminProfile,
            UserRole::Customer => $user->customerProfile,
            UserRole::Seller => $user->sellerProfile,
            UserRole::Logistics => $user->logisticsProfile,
            UserRole::Courier => $user->courierProfile,
        };

        $name = trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? ''));

        return $name !== '' ? $name : ucfirst($user->role->value).' account';
    }
}
