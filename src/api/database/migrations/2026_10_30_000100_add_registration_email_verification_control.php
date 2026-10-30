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
            'key' => 'registration_email_verification_required',
            'label' => 'Require email OTP for registration',
            'description' => 'When disabled, Customer, Seller, Logistics, and Courier registration skips inbox verification. Account approval rules still apply.',
            'enabled' => true,
            'revision' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('platform_feature_controls')->where('key', 'registration_email_verification_required')->delete();
    }
};
