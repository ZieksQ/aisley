<?php

namespace App\Services\Support;

use App\Enums\UserRole;
use App\Models\SupportTicket;
use App\Models\User;

class SupportTicketNotificationPresenter
{
    /** @var list<string> */
    public const TYPES = [
        'support-ticket.created',
        'support-ticket.requester-replied',
        'support-ticket.admin-replied',
        'support-ticket.status-changed',
    ];

    /** @return array<string, string> */
    public function payload(SupportTicket $ticket, UserRole $recipientRole, string $type): array
    {
        [$title, $summary] = $this->copy($type, (string) $ticket->reference);

        return [
            'title' => $title,
            'summary' => $summary,
            'resource_type' => 'support_ticket',
            'resource_id' => (string) $ticket->id,
            'destination' => $this->destination($recipientRole, (string) $ticket->id),
            'ticket_reference' => (string) $ticket->reference,
        ];
    }

    /** @param array<string, mixed> $data @return array{title: string, summary: string, resource_type: string|null, resource_id: string|null, destination: string|null} */
    public function project(string $type, array $data, User $recipient): array
    {
        $recipientRole = $recipient->role;
        $id = $data['resource_id'] ?? null;
        $expectedDestination = is_string($id) && $this->isUuid($id)
            ? $this->destination($recipientRole, $id)
            : null;
        $valid = in_array($type, self::TYPES, true)
            && ($data['resource_type'] ?? null) === 'support_ticket'
            && $expectedDestination !== null
            && ($data['destination'] ?? null) === $expectedDestination
            && ($recipientRole !== UserRole::Admin || $recipient->permissions()->where('slug', 'support-tickets.view')->exists());

        if (! $valid) {
            return [
                'title' => 'Notification',
                'summary' => 'An update is available.',
                'resource_type' => null,
                'resource_id' => null,
                'destination' => null,
            ];
        }

        $reference = $data['ticket_reference'] ?? null;
        $safeReference = is_string($reference) && preg_match('/^SUP-[A-Z0-9]{1,80}$/', $reference) === 1
            ? $reference
            : null;
        [$title, $summary] = $this->copy($type, $safeReference);

        return [
            'title' => $title,
            'summary' => $summary,
            'resource_type' => 'support_ticket',
            'resource_id' => $id,
            'destination' => $expectedDestination,
        ];
    }

    private function destination(UserRole $role, string $ticketId): ?string
    {
        return match ($role) {
            UserRole::Customer => "/account/support-tickets?ticket={$ticketId}",
            UserRole::Seller, UserRole::Logistics => "/support-tickets?ticket={$ticketId}",
            UserRole::Admin, UserRole::Courier => "/support-tickets/{$ticketId}",
        };
    }

    /** @return array{string, string} */
    private function copy(string $type, ?string $reference): array
    {
        $ticket = $reference !== null ? "Ticket {$reference}" : 'A support ticket';

        return match ($type) {
            'support-ticket.created' => ['New support ticket', "{$ticket} was created and is waiting for review."],
            'support-ticket.requester-replied' => ['New requester reply', "{$ticket} received a new requester reply."],
            'support-ticket.admin-replied' => ['Support ticket reply', "Support replied to {$ticket}."],
            'support-ticket.status-changed' => ['Support ticket status updated', "{$ticket} has a status update from support."],
            default => ['Notification', 'An update is available.'],
        };
    }

    private function isUuid(string $value): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
    }
}
