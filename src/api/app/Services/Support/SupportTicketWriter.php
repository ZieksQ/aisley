<?php

namespace App\Services\Support;

use App\Enums\SupportTicketEventType;
use App\Enums\SupportTicketStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Resources\Support\SupportTicketView;
use App\Models\SupportTicket;
use App\Models\SupportTicketEvent;
use App\Models\SupportTicketIdempotencyReceipt;
use App\Models\User;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SupportTicketWriter
{
    public function __construct(
        private readonly SupportTicketReader $reader,
        private readonly SupportTicketView $view,
    ) {}

    public function create(User $actor, array $input, string $key): array
    {
        return $this->mutate($actor, 'create', $key, $input, function () use ($actor, $input): array {
            $id = (string) Str::uuid();
            $ticket = new SupportTicket([
                'reference' => 'SUP-'.strtoupper(str_replace('-', '', $id)),
                'requester_user_id' => $actor->id,
                'requester_role' => $actor->role->value,
                'subject' => $input['subject'],
                'category' => $input['category'],
                'status' => SupportTicketStatus::Open,
                'revision' => 0,
                'last_sequence' => 0,
                'last_activity_at' => now(),
            ]);
            $ticket->id = $id;
            $ticket->save();
            $event = $this->append($ticket, $actor, SupportTicketEventType::Reply, $input['body']);

            return $this->result($ticket, $event, $actor, 201);
        });
    }

    public function reply(User $actor, string $id, array $input, string $key): array
    {
        return $this->mutate($actor, 'reply:'.$id, $key, $input, function () use ($actor, $id, $input): array {
            $ticket = $this->locked($actor, $id);
            $this->checkRevision($ticket, (int) $input['expected_revision']);
            if ($actor->role === UserRole::Admin && $ticket->status === SupportTicketStatus::Resolved) {
                abort(422, 'Reopen this ticket before replying.');
            }

            $reply = $this->append($ticket, $actor, SupportTicketEventType::Reply, $input['body']);
            if ($actor->role !== UserRole::Admin && in_array($ticket->status, [SupportTicketStatus::WaitingForRequester, SupportTicketStatus::Resolved], true)) {
                $this->changeStatus($ticket, $actor, SupportTicketStatus::Open);
            }

            return $this->result($ticket, $reply, $actor, 201);
        });
    }

    public function claim(User $actor, string $id, int $revision, string $key): array
    {
        return $this->mutate($actor, 'claim:'.$id, $key, ['expected_revision' => $revision], function () use ($actor, $id, $revision): array {
            $ticket = $this->locked($actor, $id);
            $this->checkRevision($ticket, $revision);
            if ($ticket->assignee_user_id !== null && $ticket->assignee_user_id !== $actor->id) {
                abort(409, 'Another administrator is assigned. Use reassignment.');
            }

            return $this->assignLocked($ticket, $actor, $actor->id);
        });
    }

    public function assign(User $actor, string $id, array $input, string $key): array
    {
        return $this->mutate($actor, 'assign:'.$id, $key, $input, function () use ($actor, $id, $input): array {
            $ticket = $this->locked($actor, $id);
            $this->checkRevision($ticket, (int) $input['expected_revision']);

            return $this->assignLocked($ticket, $actor, $input['assignee_id']);
        });
    }

    public function status(User $actor, string $id, array $input, string $key): array
    {
        return $this->mutate($actor, 'status:'.$id, $key, $input, function () use ($actor, $id, $input): array {
            $ticket = $this->locked($actor, $id);
            $this->checkRevision($ticket, (int) $input['expected_revision']);
            $target = SupportTicketStatus::from($input['status']);
            $allowed = match ($ticket->status) {
                SupportTicketStatus::Open => [SupportTicketStatus::InProgress, SupportTicketStatus::WaitingForRequester, SupportTicketStatus::Resolved],
                SupportTicketStatus::InProgress => [SupportTicketStatus::WaitingForRequester, SupportTicketStatus::Resolved],
                SupportTicketStatus::WaitingForRequester => [SupportTicketStatus::InProgress, SupportTicketStatus::Resolved],
                SupportTicketStatus::Resolved => [SupportTicketStatus::Open],
            };
            if (! in_array($target, $allowed, true)) {
                abort(422, 'This status transition is not allowed.');
            }
            if (in_array($target, [SupportTicketStatus::WaitingForRequester, SupportTicketStatus::Resolved, SupportTicketStatus::Open], true)
                && empty($input['reason'])) {
                abort(422, 'A visible reason is required for this transition.');
            }

            $event = $this->changeStatus($ticket, $actor, $target, $input['reason'] ?? null);

            return $this->result($ticket, $event, $actor);
        });
    }

    private function assignLocked(SupportTicket $ticket, User $actor, ?string $assigneeId): array
    {
        if ($ticket->assignee_user_id === $assigneeId) {
            abort(422, 'The ticket is already assigned this way.');
        }
        if ($assigneeId !== null && ! User::query()
            ->whereKey($assigneeId)->where('role', UserRole::Admin->value)->where('status', UserStatus::Active->value)
            ->whereHas('permissions', fn ($query) => $query->where('slug', 'support-tickets.view'))
            ->whereHas('permissions', fn ($query) => $query->where('slug', 'support-tickets.manage'))
            ->exists()) {
            abort(422, 'The assignee must be an active support-authorized administrator.');
        }

        $previous = $ticket->assignee_user_id;
        $ticket->assignee_user_id = $assigneeId;
        $event = $this->append($ticket, $actor, SupportTicketEventType::Assignment, null, null, null, $previous, $assigneeId);
        if ($assigneeId !== null && $ticket->status === SupportTicketStatus::Open) {
            $this->changeStatus($ticket, $actor, SupportTicketStatus::InProgress);
        }

        return $this->result($ticket, $event, $actor);
    }

    private function changeStatus(SupportTicket $ticket, User $actor, SupportTicketStatus $target, ?string $reason = null): SupportTicketEvent
    {
        $previous = $ticket->status;
        $ticket->status = $target;
        $ticket->resolved_at = $target === SupportTicketStatus::Resolved ? now() : null;

        return $this->append($ticket, $actor, SupportTicketEventType::Status, $reason, $previous, $target);
    }

    private function append(
        SupportTicket $ticket,
        User $actor,
        SupportTicketEventType $type,
        ?string $body = null,
        ?SupportTicketStatus $from = null,
        ?SupportTicketStatus $to = null,
        ?string $fromAssignee = null,
        ?string $toAssignee = null,
    ): SupportTicketEvent {
        $ticket->last_sequence++;
        $ticket->revision++;
        $ticket->last_activity_at = now();
        $ticket->save();

        return $ticket->events()->create([
            'sequence' => $ticket->last_sequence,
            'type' => $type,
            'actor_user_id' => $actor->id,
            'actor_role' => $actor->role,
            'body' => $body,
            'from_status' => $from,
            'to_status' => $to,
            'from_assignee_user_id' => $fromAssignee,
            'to_assignee_user_id' => $toAssignee,
            'created_at' => now(),
        ]);
    }

    private function locked(User $actor, string $id): SupportTicket
    {
        return $this->reader->scoped($actor)->whereKey($id)->lockForUpdate()->firstOrFail();
    }

    private function checkRevision(SupportTicket $ticket, int $expected): void
    {
        if ($ticket->revision !== $expected) {
            abort(409, 'The ticket changed. Refresh it before trying again.');
        }
    }

    private function result(SupportTicket $ticket, SupportTicketEvent $event, User $actor, int $status = 200): array
    {
        return [
            'payload' => [
                'data' => $this->reader->summary($ticket, $actor),
                'event' => $this->view->event($event, $actor),
            ],
            'status' => $status,
        ];
    }

    private function mutate(User $actor, string $action, string $key, array $input, Closure $operation): array
    {
        $hash = hash('sha256', json_encode($input, JSON_THROW_ON_ERROR));

        $result = DB::transaction(function () use ($actor, $action, $key, $hash, $operation): array {
            User::query()->whereKey($actor->id)->lockForUpdate()->firstOrFail();
            $receipt = SupportTicketIdempotencyReceipt::query()
                ->where('actor_user_id', $actor->id)->where('action', $action)
                ->where('idempotency_key', $key)->first();
            if ($receipt) {
                if (! hash_equals($receipt->payload_hash, $hash)) {
                    abort(409, 'This idempotency key was used with different input.');
                }

                return ['payload' => $receipt->response_payload, 'status' => $receipt->response_status];
            }

            $result = $operation();
            SupportTicketIdempotencyReceipt::query()->create([
                'actor_user_id' => $actor->id,
                'action' => $action,
                'idempotency_key' => $key,
                'payload_hash' => $hash,
                'response_payload' => $result['payload'],
                'response_status' => $result['status'],
            ]);

            return $result;
        }, 3);

        Log::info('Support ticket mutation completed.', [
            'actor_user_id' => $actor->id,
            'action' => $action,
            'ticket_id' => $result['payload']['data']['id'],
            'event_id' => $result['payload']['event']['id'],
        ]);

        return $result;
    }
}
