<?php

namespace App\Services\Messaging;

use App\Enums\ConversationKind;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ChatNotificationService
{
    public function __construct(
        private readonly ConversationService $shops,
        private readonly CustomerLogisticsConversationService $buyers,
        private readonly SellerLogisticsConversationService $sellers,
        private readonly CourierCounterpartyConversationService $couriers,
        private readonly OperationalConversationService $tasks,
    ) {}

    public function preview(User $actor, string $role): array
    {
        $services = match ($role) {
            'customer' => [$this->shops, $this->buyers, $this->couriers],
            'seller' => [$this->shops, $this->sellers, $this->couriers],
            'logistics' => [$this->buyers, $this->sellers, $this->tasks],
        };
        $incoming = DB::table('messages')
            ->join('conversation_participants as recipient', 'recipient.conversation_id', '=', 'messages.conversation_id')
            ->where('recipient.user_id', $actor->id)
            ->where('messages.sender_user_id', '!=', $actor->id)
            ->whereColumn('messages.sequence', '>', 'recipient.last_read_sequence')
            ->groupBy('messages.conversation_id')
            ->selectRaw('messages.conversation_id, COUNT(*) AS unread_count');

        $query = Conversation::query()
            ->joinSub($incoming, 'incoming', 'incoming.conversation_id', '=', 'conversations.id')
            ->where(function (Builder $query) use ($services, $actor, $role): void {
                foreach ($services as $service) {
                    $query->orWhereIn('conversations.id', $service->scoped($actor, $role)->select('conversations.id'));
                }
            });
        $total = (int) (clone $query)->sum('incoming.unread_count');
        $items = $query->select('conversations.*', 'incoming.unread_count as notification_unread_count')
            ->orderByDesc('conversations.last_message_at')->orderByDesc('conversations.id')
            ->limit(5)->get()->map(function (Conversation $conversation) use ($actor, $role): array {
                $service = match ($conversation->kind) {
                    ConversationKind::CustomerShop => $this->shops,
                    ConversationKind::CustomerLogistics => $this->buyers,
                    ConversationKind::SellerLogistics => $this->sellers,
                    ConversationKind::LogisticsCourier => $this->tasks,
                    ConversationKind::CourierSeller, ConversationKind::CourierCustomer => $this->couriers,
                };
                $summary = $service->summary($conversation, $actor, $role);

                return [
                    'id' => $conversation->id,
                    'kind' => $conversation->kind->value,
                    'counterparty_label' => $conversation->kind === ConversationKind::CustomerShop
                        ? ($role === 'customer' ? $summary['shop']['name'] : $summary['customer_name'])
                        : $summary['counterparty_label'],
                    'last_message_preview' => $summary['last_message_preview'],
                    'last_message_at' => $summary['last_message_at'],
                    'unread_count' => (int) $conversation->notification_unread_count,
                ];
            })->all();

        return ['data' => $items, 'meta' => ['unread_count' => $total]];
    }
}
