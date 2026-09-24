<?php

namespace App\Services\Messaging;

use App\Enums\ConversationKind;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ConversationService
{
    public function scoped(User $actor, string $role): Builder
    {
        return Conversation::query()->where('kind', ConversationKind::CustomerShop->value)->when($role === 'customer',
            fn (Builder $query) => $query->where('customer_user_id', $actor->id),
            fn (Builder $query) => $query->where('seller_user_id', $actor->id)
                ->whereHas('shop', fn (Builder $shop) => $shop->where('seller_id', $actor->id)));
    }

    public function find(User $actor, string $role, string $id): Conversation
    {
        return $this->scoped($actor, $role)->whereKey($id)->firstOrFail();
    }

    public function unreadTotal(User $actor, string $role): int
    {
        return (int) DB::table('messages')
            ->join('conversations', 'conversations.id', '=', 'messages.conversation_id')
            ->where('conversations.kind', ConversationKind::CustomerShop->value)
            ->join('conversation_participants', function ($join) use ($actor): void {
                $join->on('conversation_participants.conversation_id', '=', 'conversations.id')
                    ->where('conversation_participants.user_id', '=', $actor->id);
            })
            ->when($role === 'customer',
                fn ($query) => $query->where('conversations.customer_user_id', $actor->id),
                fn ($query) => $query->join('shops', 'shops.id', '=', 'conversations.shop_id')
                    ->where('conversations.seller_user_id', $actor->id)
                    ->where('shops.seller_id', $actor->id))
            ->whereColumn('messages.sequence', '>', 'conversation_participants.last_read_sequence')
            ->where('messages.sender_user_id', '!=', $actor->id)
            ->count();
    }

    /** @param array<string, mixed> $input
     * @return array{conversation: Conversation, message: Message}
     */
    public function start(User $customer, array $input, string $key): array
    {
        return DB::transaction(function () use ($customer, $input, $key): array {
            $shopId = $input['shop_id'];
            $hash = $this->hash($shopId, $input);
            if ($existing = $this->existing($customer, $key, $hash)) {
                return $existing;
            }
            $shop = Shop::query()->whereKey($shopId)->lockForUpdate()->firstOrFail();
            if ($existing = $this->existing($customer, $key, $hash)) {
                return $existing;
            }
            $this->assertCustomerSendAllowed($shop, $input['context_type'] ?? null, true);
            $this->validateContext($customer, $shop, $input);

            $conversation = Conversation::query()->where('customer_user_id', $customer->id)
                ->where('shop_id', $shop->id)->lockForUpdate()->first();
            if (! $conversation) {
                $conversation = Conversation::create([
                    'customer_user_id' => $customer->id,
                    'seller_user_id' => $shop->seller_id,
                    'shop_id' => $shop->id,
                ]);
                ConversationParticipant::create(['conversation_id' => $conversation->id, 'user_id' => $customer->id]);
                ConversationParticipant::create(['conversation_id' => $conversation->id, 'user_id' => $shop->seller_id]);
            }
            abort_unless($conversation->seller_user_id === $shop->seller_id, 409, 'Shop ownership changed; this conversation is unavailable.');

            return ['conversation' => $conversation, 'message' => $this->persist($conversation, $customer, $input, $key, $hash)];
        }, 3);
    }

    /** @param array<string, mixed> $input
     * @return array{conversation: Conversation, message: Message}
     */
    public function send(User $actor, string $role, string $id, array $input, string $key): array
    {
        return DB::transaction(function () use ($actor, $role, $id, $input, $key): array {
            $conversation = $this->find($actor, $role, $id);
            $hash = $this->hash($conversation->shop_id, $input);
            if ($existing = $this->existing($actor, $key, $hash, $conversation->id)) {
                return $existing;
            }
            $conversation = $this->scoped($actor, $role)->whereKey($id)->lockForUpdate()->firstOrFail();
            if ($existing = $this->existing($actor, $key, $hash, $conversation->id)) {
                return $existing;
            }
            $shop = Shop::query()->whereKey($conversation->shop_id)->firstOrFail();
            if ($role === 'customer') {
                $this->assertCustomerSendAllowed($shop, $input['context_type'] ?? null, false);
            } else {
                abort_unless($shop->seller_id === $actor->id && $conversation->seller_user_id === $actor->id, 404);
                abort_unless($shop->status === ShopStatus::Active, 409, 'This Shop cannot send new messages right now.');
            }
            $this->validateContext($actor, $shop, $input, $conversation);

            return ['conversation' => $conversation, 'message' => $this->persist($conversation, $actor, $input, $key, $hash)];
        }, 3);
    }

    public function read(User $actor, string $role, string $id, int $sequence): Conversation
    {
        return DB::transaction(function () use ($actor, $role, $id, $sequence): Conversation {
            $conversation = $this->scoped($actor, $role)->whereKey($id)->firstOrFail();
            $participant = ConversationParticipant::query()->where('conversation_id', $id)
                ->where('user_id', $actor->id)->lockForUpdate()->firstOrFail();
            abort_unless($sequence <= $conversation->last_sequence
                && $conversation->messages()->where('sequence', $sequence)->exists(), 422, 'Unknown message sequence.');
            if ($sequence > $participant->last_read_sequence) {
                $participant->update(['last_read_sequence' => $sequence]);
            }

            return $conversation;
        });
    }

    public function summary(Conversation $conversation, User $viewer, string $role): array
    {
        $conversation->loadMissing(['shop.seller:id,role,status', 'customer.customerProfile:user_id,first_name,last_name', 'lastMessage']);
        $read = ConversationParticipant::query()->where('conversation_id', $conversation->id)
            ->where('user_id', $viewer->id)->value('last_read_sequence') ?? 0;
        $unread = $conversation->messages()->where('sequence', '>', $read)
            ->where('sender_user_id', '!=', $viewer->id)->count();

        return [
            'id' => $conversation->id,
            'shop' => ['id' => $conversation->shop_id, 'name' => $conversation->shop?->name ?? 'Shop unavailable', 'slug' => $conversation->shop?->slug],
            'customer_name' => $role === 'seller' ? trim(($conversation->customer?->customerProfile?->first_name ?? 'Customer').' '.($conversation->customer?->customerProfile?->last_name ?? '')) : null,
            'last_message_preview' => $conversation->lastMessage ? mb_substr($conversation->lastMessage->body, 0, 120) : null,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'last_sequence' => $conversation->last_sequence,
            'last_read_sequence' => (int) $read,
            'unread_count' => $unread,
            'send_allowed' => $this->canSend($conversation),
        ];
    }

    public function message(Message $message, Conversation $conversation, User $viewer): array
    {
        $context = null;
        if ($message->product_id) {
            $product = Product::query()->storefrontVisible()->where('shop_id', $conversation->shop_id)
                ->whereKey($message->product_id)->first(['id', 'name']);
            $context = $product ? ['type' => 'product', 'id' => $product->id, 'label' => $product->name,
                'url' => $viewer->role === UserRole::Seller ? '/products/'.$product->id.'/edit' : '/products/'.$product->id]
                : ['type' => 'product', 'id' => null, 'label' => 'Product unavailable', 'url' => null];
        } elseif ($message->order_id) {
            $order = Order::query()->whereKey($message->order_id)
                ->where('customer_id', $conversation->customer_user_id)->where('shop_id', $conversation->shop_id)
                ->first(['id', 'reference']);
            $context = $order ? ['type' => 'order', 'id' => $order->id, 'label' => 'Order '.$order->reference, 'url' => '/orders/'.$order->id]
                : ['type' => 'order', 'id' => null, 'label' => 'Order unavailable', 'url' => null];
        }

        return [
            'id' => $message->id,
            'sequence' => $message->sequence,
            'body' => $message->body,
            'mine' => $message->sender_user_id === $viewer->id,
            'sender_role' => $message->sender_user_id === $conversation->customer_user_id ? 'customer' : 'seller',
            'context' => $context,
            'created_at' => $message->created_at?->toIso8601String(),
        ];
    }

    private function canSend(Conversation $conversation): bool
    {
        $shop = $conversation->shop;
        if (! $shop || $shop->seller_id !== $conversation->seller_user_id) {
            return false;
        }

        return $shop->status === ShopStatus::Active
            && $shop->seller?->role === UserRole::Seller && $shop->seller?->status === UserStatus::Active;
    }

    private function assertCustomerSendAllowed(Shop $shop, ?string $contextType, bool $starting): void
    {
        if ($starting && $contextType !== 'order') {
            abort_unless(Shop::query()->storefrontVisible()->whereKey($shop->id)->exists(), 404);
        }
        abort_unless($shop->status === ShopStatus::Active && $shop->seller?->role === UserRole::Seller
            && $shop->seller?->status === UserStatus::Active, 409, 'This Shop cannot receive new messages right now.');
    }

    /** @param array<string, mixed> $input */
    private function validateContext(User $actor, Shop $shop, array $input, ?Conversation $conversation = null): void
    {
        $type = $input['context_type'] ?? null;
        $id = $input['context_id'] ?? null;
        if ($type === 'product') {
            abort_unless(Product::query()->storefrontVisible()->where('shop_id', $shop->id)->whereKey($id)->exists(), 422, 'The Product is unavailable for this Shop.');
        } elseif ($type === 'order') {
            $customerId = $conversation?->customer_user_id ?? $actor->id;
            abort_unless(Order::query()->whereKey($id)->where('customer_id', $customerId)
                ->where('shop_id', $shop->id)->whereHas('items')->exists(), 422, 'The Order is unavailable for this Shop.');
        }
    }

    /** @param array<string, mixed> $input */
    private function hash(string $shopId, array $input): string
    {
        return hash('sha256', json_encode([$shopId, $input['body'], $input['context_type'] ?? null, $input['context_id'] ?? null], JSON_THROW_ON_ERROR));
    }

    /** @return array{conversation: Conversation, message: Message}|null */
    private function existing(User $actor, string $key, string $hash, ?string $conversationId = null): ?array
    {
        $message = Message::query()->where('sender_user_id', $actor->id)->where('idempotency_key', $key)->first();
        if (! $message) {
            return null;
        }
        if ($message->payload_hash !== $hash || ($conversationId !== null && $message->conversation_id !== $conversationId)) {
            throw new ConflictHttpException('This send key was already used for a different message.');
        }
        $conversation = Conversation::query()->whereKey($message->conversation_id)->firstOrFail();

        return ['conversation' => $conversation, 'message' => $message];
    }

    /** @param array<string, mixed> $input */
    private function persist(Conversation $conversation, User $actor, array $input, string $key, string $hash): Message
    {
        $sequence = $conversation->last_sequence + 1;
        $message = Message::create([
            'conversation_id' => $conversation->id,
            'sender_user_id' => $actor->id,
            'sequence' => $sequence,
            'idempotency_key' => $key,
            'payload_hash' => $hash,
            'body' => $input['body'],
            'product_id' => ($input['context_type'] ?? null) === 'product' ? $input['context_id'] : null,
            'order_id' => ($input['context_type'] ?? null) === 'order' ? $input['context_id'] : null,
        ]);
        $conversation->update(['last_sequence' => $sequence, 'last_message_id' => $message->id, 'last_message_at' => $message->created_at]);

        return $message;
    }
}
