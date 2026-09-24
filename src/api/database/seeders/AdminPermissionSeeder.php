<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class AdminPermissionSeeder extends Seeder
{
    /** @var array<int, array{name: string, slug: string, description: string}> */
    private const PERMISSIONS = [
        [
            'name' => 'View account registrations',
            'slug' => 'registrations.view',
            'description' => 'View and search account registration applications.',
        ],
        [
            'name' => 'Review account registrations',
            'slug' => 'registrations.review',
            'description' => 'Approve or reject pending account registration applications.',
        ],
        [
            'name' => 'View system audit logs',
            'slug' => 'audit-logs.view',
            'description' => 'View and investigate the immutable administrative audit ledger.',
        ],
        [
            'name' => 'View platform settings',
            'slug' => 'platform-settings.view',
            'description' => 'View announcement and platform-policy administration records.',
        ],
        [
            'name' => 'Manage platform settings',
            'slug' => 'platform-settings.manage',
            'description' => 'Create, edit, publish, archive, and version platform content.',
        ],
        [
            'name' => 'View Admin notifications',
            'slug' => 'notifications.view',
            'description' => 'View and manage the authenticated administrator notification inbox.',
        ],
        [
            'name' => 'View notification campaigns',
            'slug' => 'notification-campaigns.view',
            'description' => 'View outbound Customer in-app campaign drafts and aggregate history.',
        ],
        [
            'name' => 'Manage notification campaigns',
            'slug' => 'notification-campaigns.manage',
            'description' => 'Create, edit, preview, and send Customer in-app notification campaigns.',
        ],
        [
            'name' => 'View user accounts',
            'slug' => 'users.view',
            'description' => 'Search and inspect non-Admin user accounts and lifecycle history.',
        ],
        [
            'name' => 'Manage user accounts',
            'slug' => 'users.manage',
            'description' => 'Suspend, restore, and deactivate eligible non-Admin user accounts.',
        ],
        [
            'name' => 'Manage Seller compliance',
            'slug' => 'seller_compliance.manage',
            'description' => 'Review Seller and Product compliance cases and apply authorized actions.',
        ],
        [
            'name' => 'View finance',
            'slug' => 'finance.view',
            'description' => 'View platform finance reports, ledgers, remittances, and payouts.',
        ],
        [
            'name' => 'Manage finance',
            'slug' => 'finance.manage',
            'description' => 'Publish rates and commissions, reconcile remittances, manage holds, and run sandbox settlements.',
        ],
        [
            'name' => 'View support tickets',
            'slug' => 'support-tickets.view',
            'description' => 'View the Admin support-ticket queue and ticket history.',
        ],
        [
            'name' => 'Manage support tickets',
            'slug' => 'support-tickets.manage',
            'description' => 'Claim, assign, reply to, and change the status of support tickets.',
        ],
    ];

    public function run(): void
    {
        foreach (self::PERMISSIONS as $permission) {
            Permission::query()->updateOrCreate(
                ['slug' => $permission['slug']],
                $permission,
            );
        }
    }
}
