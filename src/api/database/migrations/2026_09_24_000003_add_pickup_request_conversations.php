<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->foreignUuid('seller_pickup_request_id')->nullable()->constrained('seller_pickup_requests')->restrictOnDelete();
            $table->unique(['logistics_organization_id', 'seller_pickup_request_id', 'seller_user_id'], 'seller_logistics_conversation_identity');
        });
    }

    public function down(): void
    {
        DB::table('conversations')->where('kind', 'seller_logistics')->delete();
        Schema::table('conversations', function (Blueprint $table): void {
            $table->dropUnique('seller_logistics_conversation_identity');
            $table->dropConstrainedForeignId('seller_pickup_request_id');
        });
    }
};
