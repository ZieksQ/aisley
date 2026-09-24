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
            $table->foreignUuid('order_id')->nullable()->constrained('orders')->restrictOnDelete();
            $table->unique(['logistics_organization_id', 'order_id', 'customer_user_id'], 'customer_logistics_conversation_identity');
        });
    }

    public function down(): void
    {
        DB::table('conversations')->where('kind', 'customer_logistics')->delete();
        Schema::table('conversations', function (Blueprint $table): void {
            $table->dropUnique('customer_logistics_conversation_identity');
            $table->dropConstrainedForeignId('order_id');
        });
    }
};
