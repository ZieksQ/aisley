<?php

namespace App\Services\Notifications;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;

class NotificationCategoryCatalog
{
    /** @var array<string, array<string, array{label: string, types: list<string>, prefixes: list<string>}>> */
    private const CATEGORIES = [
        'customer' => [
            'orders' => ['label' => 'Orders', 'types' => [], 'prefixes' => ['customer-order.']],
            'support' => ['label' => 'Support tickets', 'types' => [], 'prefixes' => ['support-ticket.']],
            'promotions' => ['label' => 'Promotions', 'types' => [], 'prefixes' => ['customer-promo.', 'customer-campaign.']],
            'announcements' => ['label' => 'Announcements', 'types' => [], 'prefixes' => ['customer-announcement.']],
            'questions-reviews' => ['label' => 'Questions & reviews', 'types' => [], 'prefixes' => ['customer-product-qa.', 'customer-product-review.']],
            'other' => ['label' => 'Other', 'types' => [], 'prefixes' => []],
        ],
        'admin' => [
            'registrations' => ['label' => 'Account registrations', 'types' => [], 'prefixes' => ['account-registration.']],
            'support' => ['label' => 'Support tickets', 'types' => [], 'prefixes' => ['support-ticket.']],
            'finance' => ['label' => 'Finance', 'types' => [], 'prefixes' => ['finance.', 'finance-', 'cod_invoice_']],
            'other' => ['label' => 'Other', 'types' => [], 'prefixes' => []],
        ],
        'seller' => [
            'orders' => ['label' => 'Orders', 'types' => [], 'prefixes' => ['seller-order.']],
            'pickups' => ['label' => 'Pickups', 'types' => [], 'prefixes' => ['pickup-schedule.']],
            'inventory' => ['label' => 'Inventory', 'types' => [], 'prefixes' => ['inventory.']],
            'compliance' => ['label' => 'Compliance', 'types' => [], 'prefixes' => ['seller-compliance.']],
            'questions-reviews' => ['label' => 'Questions & reviews', 'types' => [], 'prefixes' => ['seller-product-qa.', 'seller-product-review.']],
            'support' => ['label' => 'Support tickets', 'types' => [], 'prefixes' => ['support-ticket.']],
            'other' => ['label' => 'Other', 'types' => [], 'prefixes' => []],
        ],
        'logistics' => [
            'pickups' => ['label' => 'Pickups', 'types' => [], 'prefixes' => ['logistics-pickup.', 'pickup-schedule.']],
            'couriers' => ['label' => 'Couriers', 'types' => [], 'prefixes' => ['logistics-courier.']],
            'deliveries' => ['label' => 'Deliveries', 'types' => [], 'prefixes' => ['logistics-task.', 'logistics-evidence.', 'logistics-completion.', 'courier-task.']],
            'linehaul' => ['label' => 'Linehaul', 'types' => [], 'prefixes' => ['logistics-linehaul.', 'courier-linehaul.']],
            'finance' => ['label' => 'Finance', 'types' => ['cod_invoice_issued', 'cod_invoice_overdue'], 'prefixes' => ['finance.', 'finance-']],
            'support' => ['label' => 'Support tickets', 'types' => [], 'prefixes' => ['support-ticket.']],
            'other' => ['label' => 'Other', 'types' => [], 'prefixes' => []],
        ],
        'courier' => [
            'pickups' => ['label' => 'Pickups', 'types' => [], 'prefixes' => ['pickup-schedule.']],
            'deliveries' => ['label' => 'Deliveries', 'types' => [], 'prefixes' => ['courier-task.']],
            'linehaul' => ['label' => 'Linehaul', 'types' => [], 'prefixes' => ['courier-linehaul.']],
            'support' => ['label' => 'Support tickets', 'types' => [], 'prefixes' => ['support-ticket.']],
            'other' => ['label' => 'Other', 'types' => [], 'prefixes' => []],
        ],
    ];

    /** @return list<array{key: string, label: string}> */
    public function options(UserRole $role): array
    {
        $categories = self::CATEGORIES[$role->value];

        return array_map(
            fn (string $key, array $category): array => ['key' => $key, 'label' => $category['label']],
            array_keys($categories),
            array_values($categories),
        );
    }

    /** @return list<string> */
    public function keys(UserRole $role): array
    {
        return array_keys(self::CATEGORIES[$role->value]);
    }

    public function category(UserRole $role, string $type): string
    {
        foreach (self::CATEGORIES[$role->value] as $key => $category) {
            if ($key === 'other') {
                continue;
            }
            if (in_array($type, $category['types'], true)) {
                return $key;
            }
            foreach ($category['prefixes'] as $prefix) {
                if (str_starts_with($type, $prefix)) {
                    return $key;
                }
            }
        }

        return 'other';
    }

    public function label(UserRole $role, string $category): string
    {
        return self::CATEGORIES[$role->value][$category]['label']
            ?? self::CATEGORIES[$role->value]['other']['label'];
    }

    public function filter(Builder|Relation $query, UserRole $role, ?string $category): void
    {
        if ($category === null || $category === '' || $category === 'all') {
            return;
        }

        $categories = self::CATEGORIES[$role->value];
        if ($category === 'other') {
            $query->where(function (Builder $builder) use ($categories): void {
                foreach ($categories as $key => $mapped) {
                    if ($key === 'other') {
                        continue;
                    }
                    foreach ($mapped['types'] as $type) {
                        $builder->where('type', '!=', $type);
                    }
                    foreach ($mapped['prefixes'] as $prefix) {
                        $builder->where('type', 'not like', $prefix.'%');
                    }
                }
            });

            return;
        }

        $mapped = $categories[$category] ?? $categories['other'];
        $query->where(function (Builder $builder) use ($mapped): void {
            foreach ($mapped['types'] as $type) {
                $builder->orWhere('type', $type);
            }
            foreach ($mapped['prefixes'] as $prefix) {
                $builder->orWhere('type', 'like', $prefix.'%');
            }
        });
    }
}
