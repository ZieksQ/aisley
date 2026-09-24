<?php

namespace App\Services\Messaging;

use App\Enums\ConversationKind;
use App\Enums\OrderStatus;
use App\Enums\ShipmentStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\LogisticsOrganization;
use App\Models\Message;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class CustomerLogisticsConversationService
{
    public function scoped(User $actor, string $role): Builder
    {
        $query = Conversation::query()->where('kind', ConversationKind::CustomerLogistics->value)
            ->whereHas('participants', fn (Builder $participant) => $participant->where('user_id', $actor->id));

        if ($role === 'customer') {
            return $query->where('customer_user_id', $actor->id);
        }

        $org = $this->organization($actor);

        return $query->where('logistics_user_id', $actor->id)
            ->where('logistics_organization_id', $org->id)
            ->where('logistics_hub_id', $org->hub->id);
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
    public function start(User $actor, string $role, string $orderId, string $body, string $key): array
    {
        $hash = $this->hash(['start', $orderId, $body]);
        if ($prior = $this->prior($actor, $role, $key, $hash)) {
            return $prior;
        }

        return DB::transaction(function () use ($actor, $role, $orderId, $body, $key, $hash): array {
            $order = Order::query()->whereKey($orderId)->lockForUpdate()->firstOrFail();
            if ($prior = $this->prior($actor, $role, $key, $hash)) {
                return $prior;
            }
            $handler = $this->handler($order, true);
            abort_unless($handler && ($role !== 'customer' || $order->customer_id === $actor->id)
                && ($role !== 'logistics' || $handler['organization']->user_id === $actor->id), 404);

            $conversation = Conversation::query()->where('kind', ConversationKind::CustomerLogistics->value)
                ->where('order_id', $order->id)
                ->where('customer_user_id', $order->customer_id)
                ->where('logistics_organization_id', $handler['organization']->id)
                ->lockForUpdate()->first();
            if (! $conversation) {
                $conversation = Conversation::create([
                    'kind' => ConversationKind::CustomerLogistics,
                    'order_id' => $order->id,
                    'customer_user_id' => $order->customer_id,
                    'logistics_organization_id' => $handler['organization']->id,
                    'logistics_hub_id' => $handler['hub_id'],
                    'logistics_user_id' => $handler['organization']->user_id,
                ]);
                foreach ([$order->customer_id, $handler['organization']->user_id] as $userId) {
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
            $order = Order::query()->whereKey($conversation->order_id)->lockForUpdate()->firstOrFail();
            $conversation = $this->scoped($actor, $role)->whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            if ($prior = $this->prior($actor, $role, $key, $hash, $conversation->id)) {
                return $prior;
            }
            $handler = $this->handler($order, true);
            if (! $handler || $order->customer_id !== $conversation->customer_user_id
                || $handler['organization']->id !== $conversation->logistics_organization_id
                || $handler['hub_id'] !== $conversation->logistics_hub_id
                || $handler['organization']->user_id !== $conversation->logistics_user_id) {
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
        $conversation->loadMissing(['lastMessage', 'order', 'organization']);
        $read = (int) ($conversation->participants()->where('user_id', $actor->id)->value('last_read_sequence') ?? 0);
        $unread = $conversation->messages()->where('sequence', '>', $read)
            ->where('sender_user_id', '!=', $actor->id)->count();
        $order = $conversation->order;
        $handler = $order ? $this->handler($order) : null;
        $allowed = $handler && $handler['organization']->id === $conversation->logistics_organization_id
            && $handler['hub_id'] === $conversation->logistics_hub_id
            && $handler['organization']->user_id === $conversation->logistics_user_id;

        return [
            'id' => $conversation->id,
            'kind' => ConversationKind::CustomerLogistics->value,
            'order_id' => $conversation->order_id,
            'order_reference' => $order?->reference,
            'counterparty_role' => $role === 'customer' ? 'logistics' : 'customer',
            'counterparty_label' => $role === 'customer'
                ? ($conversation->organization?->business_name ?: 'Logistics') : 'Customer',
            'last_message_preview' => $conversation->lastMessage ? mb_substr($conversation->lastMessage->body, 0, 120) : null,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'last_sequence' => $conversation->last_sequence,
            'last_read_sequence' => $read,
            'unread_count' => $unread,
            'send_allowed' => (bool) $allowed,
            'read_only_reason' => $allowed ? null : 'ORDER_RELATIONSHIP_ENDED',
        ];
    }

    public function message(Message $message, Conversation $conversation, User $actor): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $conversation->id,
            'sequence' => $message->sequence,
            'sender_role' => $message->sender_user_id === $conversation->customer_user_id ? 'customer' : 'logistics',
            'mine' => $message->sender_user_id === $actor->id,
            'body' => $message->body,
            'created_at' => $message->created_at?->toIso8601String(),
        ];
    }

    /** @return array{organization: LogisticsOrganization, hub_id: string}|null */
    private function handler(Order $order, bool $lock = false): ?array
    {
        if (in_array($order->status, [OrderStatus::PendingPayment, OrderStatus::Placed,
            OrderStatus::SellerProcessing, OrderStatus::Delivered, OrderStatus::Cancelled,
            OrderStatus::Rejected, OrderStatus::DeliveryFailed, OrderStatus::ReturnRequested,
            OrderStatus::Returned], true)) {
            return null;
        }
        $parcel = $order->parcel()->first();
        $shipmentQuery = $parcel ? Shipment::query()->where('parcel_id', $parcel->id) : null;
        if ($lock) {
            $shipmentQuery?->lockForUpdate();
        }
        $shipment = $shipmentQuery?->first();
        if ($shipment) {
            if ($shipment->status === ShipmentStatus::InTransfer) {
                return null;
            }
            $organizationId = $shipment->current_logistics_organization_id;
            $hubId = $shipment->current_hub_id;
        } else {
            $waybill = $order->waybill()->first();
            $organizationId = $waybill?->logistics_organization_id;
            $hubId = $waybill?->logistics_hub_id;
        }
        if (! $organizationId || ! $hubId) {
            return null;
        }
        $organization = LogisticsOrganization::query()->with('hub', 'user')->find($organizationId);
        if (! $organization || $organization->hub?->id !== $hubId || $organization->user?->status?->value !== 'active'
            || $order->customer?->status?->value !== 'active') {
            return null;
        }

        return ['organization' => $organization, 'hub_id' => $hubId];
    }

    private function organization(User $actor): LogisticsOrganization
    {
        return $actor->logisticsOrganization()->with('hub')->whereHas('hub')->firstOrFail();
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
