<?php

namespace App\Services\Messaging\Media;

use App\Enums\ConversationKind;
use App\Models\Conversation;
use App\Models\User;
use App\Services\Messaging\ConversationService;
use App\Services\Messaging\CourierCounterpartyConversationService;
use App\Services\Messaging\CustomerLogisticsConversationService;
use App\Services\Messaging\OperationalConversationService;
use App\Services\Messaging\SellerLogisticsConversationService;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class ChatAttachmentScope
{
    public function service(Conversation $conversation): object
    {
        return app(match ($conversation->kind) {
            ConversationKind::CustomerShop => ConversationService::class,
            ConversationKind::CustomerLogistics => CustomerLogisticsConversationService::class,
            ConversationKind::SellerLogistics => SellerLogisticsConversationService::class,
            ConversationKind::LogisticsCourier => OperationalConversationService::class,
            ConversationKind::CourierSeller, ConversationKind::CourierCustomer => CourierCounterpartyConversationService::class,
        });
    }

    public function find(User $actor, string $id, bool $sending = false): Conversation
    {
        $record = Conversation::query()->findOrFail($id);
        $role = $actor->role->value;
        $roles = match ($record->kind) {
            ConversationKind::CustomerShop => ['customer', 'seller'],
            ConversationKind::CustomerLogistics => ['customer', 'logistics'],
            ConversationKind::SellerLogistics => ['seller', 'logistics'],
            ConversationKind::LogisticsCourier => ['logistics', 'courier'],
            ConversationKind::CourierSeller => ['courier', 'seller'],
            ConversationKind::CourierCustomer => ['courier', 'customer'],
        };
        abort_unless(in_array($role, $roles, true), 404);
        $service = $this->service($record);
        $record = $service->find($actor, $role, $id);
        if ($sending) {
            abort_unless($service->summary($record, $actor, $role)['send_allowed'], 409, 'This conversation is read only.');
        }

        return $record;
    }

    public function resolve(User $actor, array $input): Conversation
    {
        if (isset($input['conversation_id'])) {
            Validator::make($input, ['conversation_id' => ['required', 'uuid']])->validate();

            return $this->find($actor, $input['conversation_id'], true);
        }
        $role = $actor->role->value;
        $channels = match ($role) {
            'customer' => ['shop', 'logistics', 'courier'],
            'seller' => ['logistics', 'courier'],
            'logistics', 'courier' => ['operational'],
            default => [],
        };
        Validator::make($input, ['channel' => ['required', Rule::in($channels)]])->validate();
        $channel = $input['channel'];
        if ($channel === 'shop') {
            Validator::make($input, [
                'shop_id' => ['required', 'uuid'], 'context_type' => ['nullable', Rule::in(['product', 'order'])],
                'context_id' => ['required_with:context_type', 'nullable', 'uuid'],
            ])->validate();

            return app(ConversationService::class)->mediaContext($actor, $input);
        }
        if ($role === 'courier' || ($role === 'logistics' && ! isset($input['context_type']))) {
            Validator::make($input, [
                'leg' => ['required', Rule::in(['first_mile', 'final_mile'])], 'task_id' => ['required', 'uuid'],
                'counterparty_role' => [$role === 'courier' ? 'required' : 'nullable', Rule::in(['logistics', 'seller', 'customer'])],
            ])->validate();
            if ($role === 'courier' && $input['counterparty_role'] !== 'logistics') {
                return app(CourierCounterpartyConversationService::class)->mediaContext($actor, $role, $input);
            }

            return app(OperationalConversationService::class)->mediaContext($actor, $role, $input['leg'], $input['task_id']);
        }
        $types = $role === 'logistics' ? ['order', 'pickup_request']
            : (($channel === 'logistics' && $role === 'seller') ? ['pickup_request'] : ['order']);
        Validator::make($input, ['context_type' => ['required', Rule::in($types)], 'context_id' => ['required', 'uuid']])->validate();
        if ($channel === 'courier') {
            return app(CourierCounterpartyConversationService::class)->mediaContext($actor, $role, $input);
        }

        return $input['context_type'] === 'pickup_request'
            ? app(SellerLogisticsConversationService::class)->mediaContext($actor, $role, $input['context_id'])
            : app(CustomerLogisticsConversationService::class)->mediaContext($actor, $role, $input['context_id']);
    }

    public function hash(Conversation $conversation): string
    {
        $parts = [$conversation->kind?->value ?? ConversationKind::CustomerShop->value];
        foreach (['customer_user_id', 'seller_user_id', 'shop_id', 'order_id', 'seller_pickup_request_id',
            'logistics_organization_id', 'logistics_hub_id', 'delivery_task_id', 'courier_user_id', 'logistics_user_id', 'task_leg'] as $field) {
            $parts[] = $conversation->getAttribute($field);
        }

        return hash('sha256', json_encode($parts, JSON_THROW_ON_ERROR));
    }
}
