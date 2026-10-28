<?php

namespace App\Jobs\Support;

use App\Enums\CourierAffiliationStatus;
use App\Enums\SupportTicketEventType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\SupportTicket;
use App\Models\SupportTicketEvent;
use App\Models\User;
use App\Services\Support\SupportTicketNotificationPresenter;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Ramsey\Uuid\Uuid;

class DeliverSupportTicketNotification implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $uniqueFor = 3600;

    public function __construct(
        public readonly string $ticketId,
        public readonly string $eventId,
        public readonly string $type,
    ) {}

    public function uniqueId(): string
    {
        return "support-ticket:{$this->eventId}:{$this->type}";
    }

    public function handle(SupportTicketNotificationPresenter $presenter): void
    {
        if (! in_array($this->type, SupportTicketNotificationPresenter::TYPES, true)) {
            return;
        }

        $ticket = SupportTicket::query()->whereKey($this->ticketId)->first();
        $event = $ticket?->events()->whereKey($this->eventId)->first();
        if ($ticket === null || ! $event instanceof SupportTicketEvent || ! $this->matches($ticket, $event)) {
            return;
        }

        foreach ($this->recipients($ticket, $event) as $recipient) {
            $notificationId = Uuid::uuid5(
                Uuid::NAMESPACE_URL,
                "aisley:support-ticket:{$recipient->id}:{$event->id}:{$this->type}",
            )->toString();
            if ($recipient->notifications()->whereKey($notificationId)->exists()) {
                continue;
            }

            $payload = $presenter->payload($ticket, $recipient->role, $this->type);
            try {
                $recipient->notifications()->create([
                    'id' => $notificationId,
                    'type' => $this->type,
                    'data' => $payload,
                ]);
            } catch (QueryException $exception) {
                if (! $recipient->notifications()->whereKey($notificationId)->exists()) {
                    throw $exception;
                }
            }
        }
    }

    /** @return list<User> */
    private function recipients(SupportTicket $ticket, SupportTicketEvent $event): array
    {
        if (in_array($this->type, ['support-ticket.created', 'support-ticket.requester-replied'], true)) {
            $eligibleAdmins = fn () => User::query()
                ->where('role', UserRole::Admin->value)
                ->where('status', UserStatus::Active->value)
                ->whereKeyNot($event->actor_user_id)
                ->whereHas('permissions', fn ($query) => $query->where('slug', 'notifications.view'))
                ->whereHas('permissions', fn ($query) => $query->where('slug', 'support-tickets.view'));

            if ($this->type === 'support-ticket.requester-replied' && $ticket->assignee_user_id !== null) {
                $assignee = $eligibleAdmins()->whereKey($ticket->assignee_user_id)->first();
                if ($assignee !== null) {
                    return [$assignee];
                }
            }

            return $eligibleAdmins()->get()->all();
        }

        if ($event->actor_user_id === $ticket->requester_user_id) {
            return [];
        }

        $requester = User::query()
            ->whereKey($ticket->requester_user_id)
            ->where('role', $ticket->requester_role->value)
            ->where('status', UserStatus::Active->value)
            ->first();

        return $requester !== null && $this->requesterIsEligible($requester)
            ? [$requester]
            : [];
    }

    private function matches(SupportTicket $ticket, SupportTicketEvent $event): bool
    {
        return match ($this->type) {
            'support-ticket.created' => $event->type === SupportTicketEventType::Reply
                && $event->sequence === 1
                && $event->actor_user_id === $ticket->requester_user_id
                && $event->actor_role === $ticket->requester_role,
            'support-ticket.requester-replied' => $event->type === SupportTicketEventType::Reply
                && $event->actor_user_id === $ticket->requester_user_id
                && $event->actor_role === $ticket->requester_role,
            'support-ticket.admin-replied' => $event->type === SupportTicketEventType::Reply
                && $event->actor_role === UserRole::Admin,
            'support-ticket.status-changed' => $event->type === SupportTicketEventType::Status
                && $event->actor_role === UserRole::Admin,
            default => false,
        };
    }

    private function requesterIsEligible(User $requester): bool
    {
        if ($requester->role !== UserRole::Courier) {
            return true;
        }

        $affiliation = $requester->courierLogisticsAffiliation()
            ->with('organization.user', 'organization.hub', 'hub')
            ->first();

        return $affiliation !== null
            && $affiliation->status === CourierAffiliationStatus::Approved
            && $affiliation->organization?->user?->status === UserStatus::Active
            && $affiliation->hub !== null
            && (string) $affiliation->organization?->hub?->id === (string) $affiliation->logistics_hub_id;
    }
}
