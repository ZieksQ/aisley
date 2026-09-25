<?php

namespace App\Services\Support;

use App\Enums\SupportTicketEventType;
use App\Enums\UserRole;
use App\Http\Resources\Support\SupportTicketView;
use App\Models\SupportTicket;
use App\Models\SupportTicketReadMarker;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class SupportTicketReader
{
    public function __construct(private readonly SupportTicketView $view) {}

    public function scoped(User $actor): Builder
    {
        $query = SupportTicket::query();

        return $actor->role === UserRole::Admin
            ? $query
            : $query->where('requester_user_id', $actor->id)->where('requester_role', $actor->role->value);
    }

    public function find(User $actor, string $id): SupportTicket
    {
        return $this->scoped($actor)->whereKey($id)->firstOrFail();
    }

    public function index(User $actor, array $filters): array
    {
        $query = $this->scoped($actor);
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (isset($filters['category'])) {
            $query->where('category', $filters['category']);
        }
        if ($actor->role === UserRole::Admin) {
            match ($filters['assignee'] ?? 'all') {
                'mine' => $query->where('assignee_user_id', $actor->id),
                'unassigned' => $query->whereNull('assignee_user_id'),
                default => null,
            };
        }

        $page = $query->orderByDesc('last_activity_at')->orderByDesc('id')
            ->cursorPaginate((int) ($filters['limit'] ?? 20));

        return [
            'items' => $page->getCollection()->map(fn (SupportTicket $ticket) => $this->summary($ticket, $actor))->all(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ];
    }

    public function detail(User $actor, string $id, int $limit = 30): array
    {
        $ticket = $this->find($actor, $id);
        $page = $ticket->events()->orderByDesc('sequence')->cursorPaginate($limit);

        return [
            'data' => $this->summary($ticket, $actor),
            'events' => $page->getCollection()->reverse()->map(fn ($event) => $this->view->event($event, $actor))->values()->all(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ];
    }

    public function summary(SupportTicket $ticket, User $actor): array
    {
        return $this->view->summary($ticket, $actor, $this->unreadCount($ticket, $actor));
    }

    public function unreadCount(SupportTicket $ticket, User $actor): int
    {
        $read = SupportTicketReadMarker::query()
            ->where('ticket_id', $ticket->id)->where('user_id', $actor->id)
            ->value('last_read_sequence') ?? 0;
        $query = $ticket->events()->where('sequence', '>', $read);

        if ($actor->role === UserRole::Admin) {
            $query->where('actor_user_id', $ticket->requester_user_id)
                ->where('type', SupportTicketEventType::Reply->value);
        } else {
            $query->where('actor_role', UserRole::Admin->value)
                ->whereIn('type', [SupportTicketEventType::Reply->value, SupportTicketEventType::Status->value]);
        }

        return $query->count();
    }

    public function markRead(User $actor, string $id, int $sequence): array
    {
        return DB::transaction(function () use ($actor, $id, $sequence): array {
            $ticket = $this->scoped($actor)->whereKey($id)->lockForUpdate()->firstOrFail();
            if ($sequence > $ticket->last_sequence) {
                abort(422, 'Read sequence exceeds the ticket history.');
            }

            $marker = SupportTicketReadMarker::query()->firstOrCreate(
                ['ticket_id' => $ticket->id, 'user_id' => $actor->id],
                ['last_read_sequence' => 0],
            );
            if ($sequence > $marker->last_read_sequence) {
                $marker->update(['last_read_sequence' => $sequence]);
            }

            return ['data' => $this->summary($ticket, $actor)];
        });
    }
}
