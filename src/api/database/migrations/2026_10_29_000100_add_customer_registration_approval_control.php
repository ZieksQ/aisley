<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('platform_feature_controls')->insertOrIgnore([
            'id' => (string) Str::uuid7(),
            'key' => 'customer_registration_approval_required',
            'label' => 'Require buyer account approval',
            'description' => 'When disabled, new verified buyers are automatically approved and active. Existing pending buyers still require review.',
            'enabled' => true,
            'revision' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('platform_feature_controls')->where('key', 'customer_registration_approval_required')->delete();
    }
};
