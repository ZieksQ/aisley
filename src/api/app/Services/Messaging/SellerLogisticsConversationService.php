<?php

namespace App\Services\Messaging;

use App\Enums\ConversationKind;
use App\Enums\OrderStatus;
use App\Enums\ShopStatus;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\LogisticsOrganization;
use App\Models\Message;
use App\Models\Order;
use App\Models\SellerPickupRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class SellerLogisticsConversationService
{
    public function scoped(User $actor, string $role): Builder
    {
        $query = Conversation::query()->where('kind', ConversationKind::SellerLogistics->value)
            ->whereHas('participants', fn (Builder $participant) => $participant->where('user_id', $actor->id));

        if ($role === 'seller') {
            return $query->where('seller_user_id', $actor->id)
                ->whereHas('shop', fn (Builder $shop) => $shop->where('seller_id', $actor->id));
        }

        $organization = $this->organization($actor);

        return $query->where('logistics_user_id', $actor->id)
            ->where('logistics_organization_id', $organization->id)
            ->where('logistics_hub_id', $organization->hub->id);
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
    public function start(User $actor, string $role, string $pickupId, string $body, string $key): array
    {
        $hash = $this->hash(['start', $pickupId, $body]);
        if ($prior = $this->prior($actor, $role, $key, $hash)) {
            return $prior;
        }

        return DB::transaction(function () use ($actor, $role, $pickupId, $body, $key, $hash): array {
            $pickup = SellerPickupRequest::query()->whereKey($pickupId)->lockForUpdate()->firstOrFail();
            if ($prior = $this->prior($actor, $role, $key, $hash)) {
                return $prior;
            }
            abort_unless($this->relationshipActive($pickup, true)
                && ($role !== 'seller' || $pickup->seller_id === $actor->id)
                && ($role !== 'logistics' || $pickup->organization->user_id === $actor->id), 404);

            $conversation = Conversation::query()->where('kind', ConversationKind::SellerLogistics->value)
                ->where('seller_pickup_request_id', $pickup->id)
                ->where('seller_user_id', $pickup->seller_id)
                ->where('logistics_organization_id', $pickup->logistics_organization_id)
                ->lockForUpdate()->first();
            if (! $conversation) {
                $conversation = Conversation::create([
                    'kind' => ConversationKind::SellerLogistics,
                    'seller_pickup_request_id' => $pickup->id,
                    'seller_user_id' => $pickup->seller_id,
                    'shop_id' => $pickup->shop_id,
                    'logistics_organization_id' => $pickup->logistics_organization_id,
                    'logistics_hub_id' => $pickup->logistics_hub_id,
                    'logistics_user_id' => $pickup->organization->user_id,
                ]);
                foreach ([$pickup->seller_id, $pickup->organization->user_id] as $userId) {
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
            $pickup = SellerPickupRequest::query()->whereKey($conversation->seller_pickup_request_id)->lockForUpdate()->firstOrFail();
            $conversation = $this->scoped($actor, $role)->whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            if ($prior = $this->prior($actor, $role, $key, $hash, $conversation->id)) {
                return $prior;
            }
            if (! $this->matches($conversation, $pickup) || ! $this->relationshipActive($pickup, true)) {
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
        $conversation->loadMissing(['lastMessage', 'pickupRequest', 'organization', 'shop']);
        $read = (int) ($conversation->participants()->where('user_id', $actor->id)->value('last_read_sequence') ?? 0);
        $unread = $conversation->messages()->where('sequence', '>', $read)
            ->where('sender_user_id', '!=', $actor->id)->count();
        $pickup = $conversation->pickupRequest;
        $allowed = $pickup && $this->matches($conversation, $pickup) && $this->relationshipActive($pickup);

        return [
            'id' => $conversation->id,
            'kind' => ConversationKind::SellerLogistics->value,
            'pickup_request_id' => $conversation->seller_pickup_request_id,
            'pickup_request_reference' => $pickup ? substr($pickup->id, 0, 8) : null,
            'counterparty_role' => $role === 'seller' ? 'logistics' : 'seller',
            'counterparty_label' => $role === 'seller'
                ? ($conversation->organization?->business_name ?: 'Logistics') : ($conversation->shop?->name ?: 'Seller'),
            'last_message_preview' => $conversation->lastMessage ? mb_substr($conversation->lastMessage->body, 0, 120) : null,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'last_sequence' => $conversation->last_sequence,
            'last_read_sequence' => $read,
            'unread_count' => $unread,
            'send_allowed' => (bool) $allowed,
            'read_only_reason' => $allowed ? null : 'PICKUP_RELATIONSHIP_ENDED',
        ];
    }

    public function message(Message $message, Conversation $conversation, User $actor): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $conversation->id,
            'sequence' => $message->sequence,
            'sender_role' => $message->sender_user_id === $conversation->seller_user_id ? 'seller' : 'logistics',
            'mine' => $message->sender_user_id === $actor->id,
            'body' => $message->body,
            'created_at' => $message->created_at?->toIso8601String(),
        ];
    }

    private function matches(Conversation $conversation, SellerPickupRequest $pickup): bool
    {
        return $pickup->seller_id === $conversation->seller_user_id
            && $pickup->shop_id === $conversation->shop_id
            && $pickup->logistics_organization_id === $conversation->logistics_organization_id
            && $pickup->logistics_hub_id === $conversation->logistics_hub_id
            && $pickup->organization?->user_id === $conversation->logistics_user_id;
    }

    private function relationshipActive(SellerPickupRequest $pickup, bool $lock = false): bool
    {
        $pickup->loadMissing(['shop', 'seller', 'organization.hub', 'organization.user']);
        $orders = Order::query()->whereIn('id', $pickup->orders()->select('order_id'))->orderBy('id');
        if ($lock) {
            $orders->lockForUpdate();
        }
        $hasActiveOrder = $orders->get(['id', 'status'])->contains(fn (Order $order) => ! in_array($order->status, [
            OrderStatus::Delivered, OrderStatus::Cancelled, OrderStatus::Rejected,
            OrderStatus::DeliveryFailed, OrderStatus::Returned,
        ], true));

        return $pickup->shop?->seller_id === $pickup->seller_id
            && $pickup->shop?->status === ShopStatus::Active
            && $pickup->seller?->status === UserStatus::Active
            && $pickup->organization?->user?->status === UserStatus::Active
            && $pickup->organization?->hub?->id === $pickup->logistics_hub_id
            && $hasActiveOrder;
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
