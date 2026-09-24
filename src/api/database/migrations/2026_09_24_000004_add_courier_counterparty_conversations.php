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
            $table->unique(
                ['logistics_organization_id', 'delivery_task_id', 'courier_user_id', 'seller_user_id'],
                'courier_seller_conversation_identity'
            );
            $table->unique(
                ['logistics_organization_id', 'delivery_task_id', 'courier_user_id', 'customer_user_id'],
                'courier_customer_conversation_identity'
            );
        });
    }

    public function down(): void
    {
        DB::table('conversations')->whereIn('kind', ['courier_seller', 'courier_customer'])->delete();
        Schema::table('conversations', function (Blueprint $table): void {
            $table->dropUnique('courier_seller_conversation_identity');
            $table->dropUnique('courier_customer_conversation_identity');
        });
    }
};
