<?php

namespace App\Services\Messaging;

use App\Enums\ConversationKind;
use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\DeliveryTask;
use App\Models\Message;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class CourierCounterpartyConversationService
{
    public function __construct(
        private readonly CourierCounterpartyEligibility $eligibility,
        private readonly OperationalConversationService $tasks,
    ) {}

    public function scoped(User $actor, string $role): Builder
    {
        $kinds = $role === 'courier'
            ? [ConversationKind::CourierSeller->value, ConversationKind::CourierCustomer->value]
            : [$this->kind($role === 'seller' ? 'seller' : 'customer')->value];
        $query = Conversation::query()->whereIn('kind', $kinds)
            ->whereHas('participants', fn (Builder $participant) => $participant->where('user_id', $actor->id));

        if ($role === 'seller') {
            return $query->where('seller_user_id', $actor->id)
                ->whereHas('shop', fn (Builder $shop) => $shop->where('seller_id', $actor->id));
        }
        if ($role === 'customer') {
            return $query->where('customer_user_id', $actor->id);
        }

        $affiliation = $this->eligibility->courierAffiliation($actor);

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
            ->where('messages.sender_user_id', '!=', $actor->id)->count();
    }

    /** @return array{conversation: Conversation, message: Message, replay: bool} */
    public function startFromTask(User $courier, string $counterpart, string $leg, string $taskId, string $body, string $key): array
    {
        abort_unless(in_array($counterpart, ['seller', 'customer'], true), 422);
        abort_unless(($counterpart === 'seller' && $leg === FulfillmentTaskLeg::FirstMile->value)
            || ($counterpart === 'customer' && $leg === FulfillmentTaskLeg::FinalMile->value), 422);
        $hash = $this->hash(['start', $leg, $taskId, $counterpart, $body]);
        if ($prior = $this->prior($courier, 'courier', $key, $hash)) {
            return $prior;
        }
        $task = $this->tasks->taskForStart($courier, 'courier', $leg, $taskId);

        return $this->start($courier, 'courier', $task, $counterpart, $body, $key, $hash);
    }

    /** @return array{conversation: Conversation, message: Message, replay: bool} */
    public function startFromOrder(User $actor, string $role, string $orderId, string $body, string $key): array
    {
        abort_unless(in_array($role, ['seller', 'customer'], true), 422);
        $hash = $this->hash(['start', 'order', $orderId, $role, $body]);
        if ($prior = $this->prior($actor, $role, $key, $hash)) {
            return $prior;
        }
        $order = Order::query()->whereKey($orderId)->firstOrFail();
        abort_unless($role === 'seller'
            ? $order->shop?->seller_id === $actor->id : $order->customer_id === $actor->id, 404);
        $leg = $role === 'seller' ? FulfillmentTaskLeg::FirstMile : FulfillmentTaskLeg::FinalMile;
        $states = $role === 'seller'
            ? [FulfillmentTaskStatus::SellerPickupAccepted->value]
            : [FulfillmentTaskStatus::DeliveryAccepted->value, FulfillmentTaskStatus::PickedUpFromHub->value,
                FulfillmentTaskStatus::InTransit->value, FulfillmentTaskStatus::OutForDelivery->value];
        $task = DeliveryTask::query()->where('leg', $leg->value)->whereIn('status', $states)
            ->whereHas('shipment.parcel', fn (Builder $parcel) => $parcel->where('order_id', $order->id))
            ->orderByDesc('updated_at')->firstOrFail();

        return $this->start($actor, $role, $task, $role, $body, $key, $hash);
    }

    /** @return array{conversation: Conversation, message: Message, replay: bool} */
    private function start(User $actor, string $role, DeliveryTask $task, string $counterpart, string $body, string $key, string $hash): array
    {
        return DB::transaction(function () use ($actor, $role, $task, $counterpart, $body, $key, $hash): array {
            $task = DeliveryTask::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
            if ($prior = $this->prior($actor, $role, $key, $hash)) {
                return $prior;
            }
            $context = $this->eligibility->resolve($task, $counterpart, true);
            abort_unless($role === 'courier'
                ? $context['courier_id'] === $actor->id
                : $context['counterpart_id'] === $actor->id, 404);
            $conversation = Conversation::query()->where('kind', $this->kind($counterpart)->value)
                ->where('delivery_task_id', $task->id)
                ->where('courier_user_id', $context['courier_id'])
                ->where($counterpart === 'seller' ? 'seller_user_id' : 'customer_user_id', $context['counterpart_id'])
                ->lockForUpdate()->first();
            if (! $conversation) {
                $conversation = Conversation::create([
                    'kind' => $this->kind($counterpart),
                    'delivery_task_id' => $task->id,
                    'courier_user_id' => $context['courier_id'],
                    'seller_user_id' => $counterpart === 'seller' ? $context['counterpart_id'] : null,
                    'customer_user_id' => $counterpart === 'customer' ? $context['counterpart_id'] : null,
                    'shop_id' => $context['shop_id'],
                    'logistics_organization_id' => $context['organization']->id,
                    'logistics_hub_id' => $context['organization']->hub->id,
                    'task_leg' => $task->leg->value,
                ]);
                foreach ([$context['courier_id'], $context['counterpart_id']] as $userId) {
                    ConversationParticipant::create(['conversation_id' => $conversation->id, 'user_id' => $userId]);
                }
            }
            $message = $this->persist($conversation, $actor, $body, $key, $hash);

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
            $counterpart = $conversation->kind === ConversationKind::CourierSeller ? 'seller' : 'customer';
            $context = $this->eligibility->resolve($task, $counterpart, true);
            if (! $this->matches($conversation, $context, $task)) {
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
        $conversation->loadMissing(['lastMessage', 'task.shipment.parcel.order', 'shop']);
        $read = (int) ($conversation->participants()->where('user_id', $actor->id)->value('last_read_sequence') ?? 0);
        $unread = $conversation->messages()->where('sequence', '>', $read)
            ->where('sender_user_id', '!=', $actor->id)->count();
        $counterpart = $conversation->kind === ConversationKind::CourierSeller ? 'seller' : 'customer';
        try {
            $context = $this->eligibility->resolve($conversation->task, $counterpart);
            $allowed = $this->matches($conversation, $context, $conversation->task);
        } catch (HttpExceptionInterface|FulfillmentException|ModelNotFoundException) {
            $allowed = false;
        }
        $order = $conversation->task?->shipment?->parcel?->order;

        return [
            'id' => $conversation->id,
            'kind' => $conversation->kind->value,
            'leg' => $conversation->task_leg,
            'task_id' => $role === 'courier' && $conversation->task_leg === 'first_mile'
                ? $conversation->task?->legacy_first_mile_task_id : $conversation->delivery_task_id,
            'task_reference' => $conversation->task?->shipment?->parcel?->reference,
            'order_id' => $order?->id,
            'order_reference' => $order?->reference,
            'counterparty_role' => $role === 'courier' ? $counterpart : 'courier',
            'counterparty_label' => $role === 'courier'
                ? ($counterpart === 'seller' ? ($conversation->shop?->name ?: 'Seller') : 'Buyer') : 'Courier',
            'last_message_preview' => $conversation->lastMessage ? mb_substr($conversation->lastMessage->body, 0, 120) : null,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'last_sequence' => $conversation->last_sequence,
            'last_read_sequence' => $read,
            'unread_count' => $unread,
            'send_allowed' => $allowed,
            'read_only_reason' => $allowed ? null : 'TASK_NOT_ACTIVE',
        ];
    }

    public function message(Message $message, Conversation $conversation, User $actor): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $conversation->id,
            'sequence' => $message->sequence,
            'sender_role' => $message->sender_user_id === $conversation->courier_user_id ? 'courier'
                : ($conversation->kind === ConversationKind::CourierSeller ? 'seller' : 'customer'),
            'mine' => $message->sender_user_id === $actor->id,
            'body' => $message->body,
            'created_at' => $message->created_at?->toIso8601String(),
        ];
    }

    private function matches(Conversation $conversation, array $context, DeliveryTask $task): bool
    {
        return $conversation->delivery_task_id === $task->id
            && $conversation->courier_user_id === $context['courier_id']
            && $conversation->logistics_organization_id === $context['organization']->id
            && $conversation->logistics_hub_id === $context['organization']->hub->id
            && ($conversation->kind === ConversationKind::CourierSeller
                ? $conversation->seller_user_id === $context['counterpart_id'] && $conversation->shop_id === $context['shop_id']
                : $conversation->customer_user_id === $context['counterpart_id']);
    }

    private function kind(string $counterpart): ConversationKind
    {
        return $counterpart === 'seller' ? ConversationKind::CourierSeller : ConversationKind::CourierCustomer;
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
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_user_id' => $actor->id,
            'sequence' => $conversation->last_sequence + 1,
            'idempotency_key' => $key,
            'payload_hash' => $hash,
            'body' => $body,
        ]);
        $conversation->update(['last_sequence' => $message->sequence, 'last_message_id' => $message->id,
            'last_message_at' => $message->created_at]);

        return $message;
    }

    private function hash(array $parts): string
    {
        return hash('sha256', json_encode($parts, JSON_THROW_ON_ERROR));
    }
}
