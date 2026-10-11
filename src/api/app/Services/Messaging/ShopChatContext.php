<?php

namespace App\Services\Messaging;

use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Shop;
use App\Models\User;

class ShopChatContext
{
    public static function availability(?Shop $shop): string
    {
        if (! $shop || $shop->status !== ShopStatus::Active || $shop->seller?->role !== UserRole::Seller || $shop->seller?->status !== UserStatus::Active) {
            return 'offline';
        }

        return $shop->is_on_vacation ? 'vacation' : 'online';
    }

    public static function shop(?Shop $shop): array
    {
        return ['id' => $shop?->id, 'name' => $shop?->name ?? 'Shop unavailable', 'slug' => $shop?->slug, 'availability' => self::availability($shop)];
    }

    public function get(User $customer, string $id): array
    {
        $conversation = app(ConversationService::class)->scoped($customer, 'customer')->where('shop_id', $id)->first();
        $shop = Shop::query()->with('seller:id,role,status')->findOrFail($id);
        $availability = self::availability($shop);
        abort_unless($conversation || $availability !== 'offline', 404);

        return ['shop' => self::shop($shop), 'conversation_id' => $conversation?->id,
            'send_allowed' => $availability === 'online'];
    }
}
