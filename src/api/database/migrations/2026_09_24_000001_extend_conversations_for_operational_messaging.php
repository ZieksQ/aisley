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
            $table->string('kind', 32)->default('customer_shop');
            $table->uuid('customer_user_id')->nullable()->change();
            $table->uuid('seller_user_id')->nullable()->change();
            $table->uuid('shop_id')->nullable()->change();
            $table->foreignUuid('logistics_organization_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignUuid('delivery_task_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignUuid('logistics_user_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('task_leg', 16)->nullable();
            $table->unique(['logistics_organization_id', 'delivery_task_id', 'courier_user_id', 'logistics_user_id'], 'operational_conversation_identity');
            $table->index(['logistics_organization_id', 'logistics_hub_id', 'last_message_at'], 'operational_conversation_inbox');
            $table->index(['courier_user_id', 'last_message_at'], 'operational_courier_inbox');
        });
    }

    public function down(): void
    {
        // Operational rows cannot satisfy the original required Customer/Seller/Shop columns.
        DB::table('conversations')->where('kind', 'logistics_courier')->delete();
        Schema::table('conversations', function (Blueprint $table): void {
            $table->dropUnique('operational_conversation_identity');
            $table->dropIndex('operational_conversation_inbox');
            $table->dropIndex('operational_courier_inbox');
            $table->dropConstrainedForeignId('logistics_organization_id');
            $table->dropConstrainedForeignId('logistics_hub_id');
            $table->dropConstrainedForeignId('delivery_task_id');
            $table->dropConstrainedForeignId('courier_user_id');
            $table->dropConstrainedForeignId('logistics_user_id');
            $table->dropColumn(['kind', 'task_leg']);
            $table->uuid('customer_user_id')->nullable(false)->change();
            $table->uuid('seller_user_id')->nullable(false)->change();
            $table->uuid('shop_id')->nullable(false)->change();
        });
    }
};
