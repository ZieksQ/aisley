<?php

namespace App\Services\Messaging;

use App\Enums\ConversationKind;
use App\Enums\CourierAffiliationStatus;
use App\Enums\FirstMileTaskStatus;
use App\Enums\FulfillmentOfferStatus;
use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\CourierLogisticsAffiliation;
use App\Models\DeliveryTask;
use App\Models\FirstMileTask;
use App\Models\LogisticsOrganization;
use App\Models\Message;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class OperationalConversationService
{
    public function __construct(private readonly FulfillmentTransitionService $fulfillment) {}

    public function scoped(User $actor, string $role): Builder
    {
        $query = Conversation::query()->where('kind', ConversationKind::LogisticsCourier->value)
            ->whereHas('participants', fn (Builder $participant) => $participant->where('user_id', $actor->id));
        if ($role === 'logistics') {
            $org = $this->organization($actor);

            return $query->where('logistics_user_id', $actor->id)
                ->where('logistics_organization_id', $org->id)
                ->where('logistics_hub_id', $org->hub->id);
        }

        $affiliation = $this->affiliation($actor);

        return $query->where('courier_user_id', $actor->id)
            ->where('logistics_organization_id', $affiliation->logistics_organization_id)
            ->where('logistics_hub_id', $affiliation->logistics_hub_id);
    }

    public function find(User $actor, string $role, string $id): Conversation
    {
        return $this->scoped($actor, $role)->whereKey($id)->firstOrFail();
    }

    public function unreadTotal(User $actor, string $role): int
    {
        return (int) DB::table('messages')
            ->join('conversation_participants', function ($join) use ($actor): void {
                $join->on('conversation_participants.conversation_id', '=', 'messages.conversation_id')
                    ->where('conversation_participants.user_id', '=', $actor->id);
            })
            ->whereIn('messages.conversation_id', $this->scoped($actor, $role)->select('conversations.id'))
            ->whereColumn('messages.sequence', '>', 'conversation_participants.last_read_sequence')
            ->where('messages.sender_user_id', '!=', $actor->id)
            ->count();
    }

    public function taskForStart(User $actor, string $role, string $leg, string $taskId): DeliveryTask
    {
        if ($leg === FulfillmentTaskLeg::FirstMile->value) {
            $shared = DeliveryTask::query()->whereKey($taskId)->where('leg', FulfillmentTaskLeg::FirstMile->value)
                ->with('legacyFirstMileTask')->first();
            if ($shared !== null) {
                abort_unless($shared->legacyFirstMileTask, 404);
                $this->assertLegacyScope($actor, $role, $shared->legacyFirstMileTask);

                return $shared;
            }
            $legacy = FirstMileTask::query()->whereKey($taskId)->firstOrFail();
            $this->assertLegacyScope($actor, $role, $legacy);
            if (! in_array($legacy->status, [FirstMileTaskStatus::Assigned, FirstMileTaskStatus::Accepted], true)
                || $legacy->schedule?->status?->value !== 'scheduled') {
                throw FulfillmentException::conflict('TASK_NOT_ACTIVE', 'This task is no longer available for messaging.');
            }
            $task = DeliveryTask::query()->where('legacy_first_mile_task_id', $legacy->id)->first();
            if ($task === null) {
                // Legacy first-mile assignment may predate creation of its shared physical task.
                $this->fulfillment->ensureForWaybill($legacy->waybill);
                $task = DeliveryTask::query()->where('legacy_first_mile_task_id', $legacy->id)->firstOrFail();
            }

            return $task;
        }

        return DeliveryTask::query()->whereKey($taskId)
            ->where('leg', FulfillmentTaskLeg::FinalMile->value)->firstOrFail();
    }

    /** @return array{conversation: Conversation, message: Message, replay: bool} */
    public function start(User $actor, string $role, array $input, string $key): array
    {
        $hash = $this->hash(['start', $input['leg'], $input['task_id'], $input['body']]);
        if ($prior = $this->prior($actor, $role, $key, $hash)) {
            return $prior;
        }
        $task = $this->taskForStart($actor, $role, $input['leg'], $input['task_id']);

        return DB::transaction(function () use ($actor, $role, $task, $input, $key, $hash): array {
            $task = DeliveryTask::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            if ($prior = $this->prior($actor, $role, $key, $hash)) {
                return $prior;
            }
            $context = $this->activeContext($task, $actor, $role, true);
            $conversation = Conversation::query()->where('kind', ConversationKind::LogisticsCourier->value)
                ->where('logistics_organization_id', $context['organization']->id)
                ->where('delivery_task_id', $task->id)
                ->where('courier_user_id', $context['courier_id'])
                ->where('logistics_user_id', $context['organization']->user_id)
                ->lockForUpdate()->first();
            if ($conversation === null) {
                $conversation = Conversation::create([
                    'kind' => ConversationKind::LogisticsCourier,
                    'logistics_organization_id' => $context['organization']->id,
                    'logistics_hub_id' => $context['organization']->hub->id,
                    'delivery_task_id' => $task->id,
                    'courier_user_id' => $context['courier_id'],
                    'logistics_user_id' => $context['organization']->user_id,
                    'task_leg' => $task->leg->value,
                ]);
                foreach ([$context['organization']->user_id, $context['courier_id']] as $userId) {
                    ConversationParticipant::create(['conversation_id' => $conversation->id, 'user_id' => $userId]);
                }
            }
            $message = $this->persist($conversation, $actor, $input['body'], $key, $hash);

            return compact('conversation', 'message') + ['replay' => false];
        }, 3);
    }

    /** @return array{conversation: Conversation, message: Message, replay: bool} */
    public function send(User $actor, string $role, string $id, string $body, string $key): array
    {
        $conversation = $this->find($actor, $role, $id);
        $hash = $this->hash(['send', $id, $body]);
        if ($prior = $this->prior($actor, $role, $key, $hash, $id)) {
            return $prior;
        }

        return DB::transaction(function () use ($actor, $role, $conversation, $body, $key, $hash): array {
            $task = DeliveryTask::query()->whereKey($conversation->delivery_task_id)->lockForUpdate()->firstOrFail();
            $conversation = $this->scoped($actor, $role)->whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            if ($prior = $this->prior($actor, $role, $key, $hash, $conversation->id)) {
                return $prior;
            }
            if ($task->courier_id !== $conversation->courier_user_id) {
                throw FulfillmentException::conflict('CONVERSATION_READ_ONLY', 'This conversation is read-only.');
            }
            $context = $this->activeContext($task, $actor, $role, true);
            if ($context['organization']->id !== $conversation->logistics_organization_id
                || $context['organization']->hub->id !== $conversation->logistics_hub_id
                || $context['courier_id'] !== $conversation->courier_user_id
                || $task->leg->value !== $conversation->task_leg) {
                throw FulfillmentException::conflict('CONVERSATION_READ_ONLY', 'This conversation is read-only.');
            }
            $message = $this->persist($conversation, $actor, $body, $key, $hash);

            return compact('conversation', 'message') + ['replay' => false];
        }, 3);
    }

    public function read(User $actor, string $role, string $id, int $sequence): Conversation
    {
        return DB::transaction(function () use ($actor, $role, $id, $sequence): Conversation {
            $conversation = $this->find($actor, $role, $id);
            $participant = ConversationParticipant::query()->where('conversation_id', $id)
                ->where('user_id', $actor->id)->lockForUpdate()->firstOrFail();
            if ($sequence < 1 || $sequence > $conversation->last_sequence
                || ! $conversation->messages()->where('sequence', $sequence)->exists()) {
                throw FulfillmentException::invalid('UNKNOWN_MESSAGE_SEQUENCE', 'Unknown message sequence.', 'last_read_sequence');
            }
            if ($sequence > $participant->last_read_sequence) {
                $participant->update(['last_read_sequence' => $sequence]);
            }

            return $conversation;
        });
    }

    public function summary(Conversation $conversation, User $actor, string $role): array
    {
        $conversation->loadMissing(['lastMessage', 'courier.courierProfile', 'organization', 'task.shipment.parcel']);
        $read = (int) ($conversation->participants()->where('user_id', $actor->id)->value('last_read_sequence') ?? 0);
        $unread = $conversation->messages()->where('sequence', '>', $read)
            ->where('sender_user_id', '!=', $actor->id)->count();
        $reason = $this->readOnlyReason($conversation);
        $counterparty = $role === 'logistics'
            ? trim(($conversation->courier?->courierProfile?->first_name ?? '').' '.($conversation->courier?->courierProfile?->last_name ?? ''))
            : $conversation->organization?->business_name;

        return [
            'id' => $conversation->id,
            'leg' => $conversation->task_leg,
            'task_id' => $role === 'courier' && $conversation->task_leg === 'first_mile'
                ? $conversation->task?->legacy_first_mile_task_id : $conversation->delivery_task_id,
            'task_reference' => $conversation->task?->shipment?->parcel?->reference,
            'counterparty_role' => $role === 'logistics' ? 'courier' : 'logistics',
            'counterparty_label' => $counterparty ?: ($role === 'logistics' ? 'Courier' : 'Logistics'),
            'last_message_preview' => $conversation->lastMessage ? mb_substr($conversation->lastMessage->body, 0, 120) : null,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'last_sequence' => $conversation->last_sequence,
            'last_read_sequence' => $read,
            'unread_count' => $unread,
            'send_allowed' => $reason === null,
            'read_only_reason' => $reason,
        ];
    }

    public function message(Message $message, Conversation $conversation, User $actor): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $conversation->id,
            'sequence' => $message->sequence,
            'sender_role' => $message->sender_user_id === $conversation->courier_user_id ? 'courier' : 'logistics',
            'mine' => $message->sender_user_id === $actor->id,
            'body' => $message->body,
            'created_at' => $message->created_at?->toIso8601String(),
        ];
    }

    private function assertLegacyScope(User $actor, string $role, FirstMileTask $legacy): void
    {
        if ($role === 'courier') {
            $affiliation = $this->affiliation($actor);
            abort_unless($legacy->courier_id === $actor->id
                && $legacy->logistics_organization_id === $affiliation->logistics_organization_id
                && $legacy->logistics_hub_id === $affiliation->logistics_hub_id, 404);
        } else {
            $org = $this->organization($actor);
            abort_unless($legacy->logistics_organization_id === $org->id
                && $legacy->logistics_hub_id === $org->hub->id, 404);
        }
    }

    /** @return array{organization: LogisticsOrganization, courier_id: string} */
    private function activeContext(DeliveryTask $task, User $actor, string $role, bool $lock = false): array
    {
        $shipment = $task->shipment()->firstOrFail();
        $org = $role === 'logistics' ? $this->organization($actor)
            : $this->affiliation($actor)->organization()->with('hub')->firstOrFail();
        abort_unless($org->hub && $org->user?->status === UserStatus::Active, 404);
        $courierId = $task->courier_id;
        abort_unless($courierId && ($role !== 'courier' || $courierId === $actor->id), 404);
        $affiliationQuery = CourierLogisticsAffiliation::query()->where('courier_id', $courierId)
            ->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->where('status', CourierAffiliationStatus::Approved->value)
            ->whereHas('courier', fn (Builder $query) => $query->where('status', UserStatus::Active->value));
        if ($lock) {
            $affiliationQuery->lockForUpdate();
        }
        $affiliation = $affiliationQuery->first();
        abort_unless($affiliation, 404);

        $active = false;
        if ($task->leg === FulfillmentTaskLeg::FirstMile) {
            $legacy = $task->legacyFirstMileTask()->with('schedule')->first();
            $active = $legacy && $legacy->courier_id === $courierId
                && $legacy->logistics_organization_id === $org->id
                && $legacy->logistics_hub_id === $org->hub->id
                && in_array($legacy->status, [FirstMileTaskStatus::Assigned, FirstMileTaskStatus::Accepted], true)
                && $legacy->schedule?->status?->value === 'scheduled'
                && in_array($task->status, [FulfillmentTaskStatus::SellerPickupAssigned, FulfillmentTaskStatus::SellerPickupAccepted], true);
            $inScope = $shipment->logistics_organization_id === $org->id && $shipment->logistics_hub_id === $org->hub->id;
        } else {
            $offer = $task->offers()->where('courier_id', $courierId)->orderByDesc('sequence')->first();
            $offered = $task->status === FulfillmentTaskStatus::DeliveryAssigned && $offer?->status === FulfillmentOfferStatus::Offered;
            $accepted = in_array($task->status, [FulfillmentTaskStatus::DeliveryAccepted, FulfillmentTaskStatus::PickedUpFromHub,
                FulfillmentTaskStatus::InTransit, FulfillmentTaskStatus::OutForDelivery], true)
                && $offer?->status === FulfillmentOfferStatus::Accepted;
            $active = $offered || $accepted;
            $inScope = $shipment->current_logistics_organization_id === $org->id && $shipment->current_hub_id === $org->hub->id;
        }
        abort_unless($inScope, 404);
        if (! $active) {
            throw FulfillmentException::conflict('TASK_NOT_ACTIVE', 'This task is no longer available for messaging.');
        }

        return ['organization' => $org, 'courier_id' => $courierId];
    }

    private function readOnlyReason(Conversation $conversation): ?string
    {
        try {
            $context = $this->activeContext($conversation->task, $conversation->organization->user, 'logistics');
            if ($context['courier_id'] !== $conversation->courier_user_id
                || $context['organization']->hub->id !== $conversation->logistics_hub_id) {
                return 'TASK_NOT_ACTIVE';
            }
        } catch (FulfillmentException|HttpExceptionInterface|ModelNotFoundException) {
            return 'TASK_NOT_ACTIVE';
        }

        return null;
    }

    private function organization(User $actor): LogisticsOrganization
    {
        return $actor->logisticsOrganization()->with('hub')->whereHas('hub')->firstOrFail();
    }

    private function affiliation(User $actor): CourierLogisticsAffiliation
    {
        return $actor->courierLogisticsAffiliation()->with('organization.user', 'hub')->firstOrFail();
    }

    /** @return array{conversation: Conversation, message: Message, replay: bool}|null */
    private function prior(User $actor, string $role, string $key, string $hash, ?string $conversationId = null): ?array
    {
        $message = Message::query()->where('sender_user_id', $actor->id)->where('idempotency_key', $key)->first();
        if (! $message) {
            return null;
        }
        if ($message->payload_hash !== $hash || ($conversationId && $message->conversation_id !== $conversationId)) {
            throw FulfillmentException::conflict('IDEMPOTENCY_CONFLICT', 'This send key was already used for a different message.');
        }
        $conversation = $this->find($actor, $role, $message->conversation_id);

        return compact('conversation', 'message') + ['replay' => true];
    }

    private function persist(Conversation $conversation, User $actor, string $body, string $key, string $hash): Message
    {
        $sequence = $conversation->last_sequence + 1;
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_user_id' => $actor->id,
            'sequence' => $sequence,
            'idempotency_key' => $key,
            'payload_hash' => $hash,
            'body' => $body,
        ]);
        $conversation->update(['last_sequence' => $sequence, 'last_message_id' => $message->id, 'last_message_at' => $message->created_at]);

        return $message;
    }

    private function hash(array $parts): string
    {
        return hash('sha256', json_encode($parts, JSON_THROW_ON_ERROR));
    }
}
