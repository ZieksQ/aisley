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
