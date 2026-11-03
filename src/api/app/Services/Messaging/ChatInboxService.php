<?php

namespace App\Services\Messaging;

use App\Enums\ConversationKind;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ChatInboxService
{
    public function __construct(
        private readonly ConversationService $shops,
        private readonly CustomerLogisticsConversationService $buyers,
        private readonly SellerLogisticsConversationService $sellers,
        private readonly CourierCounterpartyConversationService $couriers,
        private readonly OperationalConversationService $tasks,
    ) {}

    public function scoped(User $actor, string $role): Builder
    {
        $services = match ($role) {
            'customer' => [$this->shops, $this->buyers, $this->couriers],
            'seller' => [$this->shops, $this->sellers, $this->couriers],
            'logistics' => [$this->buyers, $this->sellers, $this->tasks],
        };

        return Conversation::query()->where(function (Builder $query) use ($services, $actor, $role): void {
            foreach ($services as $service) {
                $query->orWhereIn('conversations.id', $service->scoped($actor, $role)->select('conversations.id'));
            }
        });
    }

    public function page(User $actor, string $role, ?string $counterparty): array
    {
        $query = $this->scoped($actor, $role)->whereNotNull('conversations.last_message_at');
        if ($counterparty !== null) {
            $kinds = match ($counterparty) {
                'customer' => ['customer_shop', 'customer_logistics'],
                'seller' => ['customer_shop', 'seller_logistics'],
                'logistics' => ['customer_logistics', 'seller_logistics'],
                'courier' => ['courier_customer', 'courier_seller', 'logistics_courier'],
            };
            $query->whereIn('conversations.kind', $kinds);
        }
        $incoming = DB::table('messages')
            ->join('conversation_participants as recipient', 'recipient.conversation_id', '=', 'messages.conversation_id')
            ->where('recipient.user_id', $actor->id)->where('messages.sender_user_id', '!=', $actor->id)
            ->whereColumn('messages.sequence', '>', 'recipient.last_read_sequence')
            ->groupBy('messages.conversation_id')
            ->selectRaw('messages.conversation_id, COUNT(*) AS inbox_unread_count');
        $query->leftJoinSub($incoming, 'incoming', 'incoming.conversation_id', '=', 'conversations.id');
        $unread = (int) (clone $query)->sum('incoming.inbox_unread_count');
        $page = $query->select('conversations.*')->orderByDesc('conversations.last_message_at')
            ->orderByDesc('conversations.id')->cursorPaginate(20);

        return ['data' => $page->getCollection()->map(fn (Conversation $conversation) => $this->summary($conversation, $actor, $role))->all(),
            'meta' => ['next_cursor' => $page->nextCursor()?->encode(), 'unread_count' => $unread]];
    }

    private function summary(Conversation $conversation, User $actor, string $role): array
    {
        $service = match ($conversation->kind) {
            ConversationKind::CustomerShop => $this->shops,
            ConversationKind::CustomerLogistics => $this->buyers,
            ConversationKind::SellerLogistics => $this->sellers,
            ConversationKind::LogisticsCourier => $this->tasks,
            ConversationKind::CourierSeller, ConversationKind::CourierCustomer => $this->couriers,
        };
        $summary = $service->summary($conversation, $actor, $role);
        $shop = $conversation->kind === ConversationKind::CustomerShop;
        $context = $this->contextLabel($summary, $shop, $role);

        return [
            'id' => $conversation->id, 'kind' => $conversation->kind->value,
            'counterparty_role' => $shop ? ($role === 'customer' ? 'seller' : 'customer') : $summary['counterparty_role'],
            'counterparty_label' => $shop ? ($role === 'customer' ? $summary['shop']['name'] : $summary['customer_name']) : $summary['counterparty_label'],
            'context_label' => $context, 'last_message_preview' => $summary['last_message_preview'],
            'last_message_at' => $summary['last_message_at'], 'unread_count' => $summary['unread_count'],
            'send_allowed' => $summary['send_allowed'], 'read_only_reason' => $summary['read_only_reason'] ?? ($summary['send_allowed'] ? null : 'CONVERSATION_READ_ONLY'),
        ];
    }

    private function contextLabel(array $summary, bool $shop, string $role): ?string
    {
        if ($shop) {
            return $role === 'seller' ? $summary['shop']['name'] : null;
        }
        if (isset($summary['pickup_request_id'])) {
            return 'Pickup '.($summary['pickup_request_reference'] ?? $summary['pickup_request_id']);
        }
        if (isset($summary['order_id'])) {
            $label = 'Order '.($summary['order_reference'] ?? $summary['order_id']);
            if (isset($summary['task_reference'])) {
                $label .= ' · Task '.$summary['task_reference'];
            }
        } else {
            $label = $summary['task_reference'] ?? 'Delivery task';
        }
        if (isset($summary['leg'])) {
            $label .= ' · '.str_replace('_', ' ', $summary['leg']);
        }

        return $label;
    }
}
