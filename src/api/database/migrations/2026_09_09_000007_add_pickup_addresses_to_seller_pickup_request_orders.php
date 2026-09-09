<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('seller_pickup_request_orders', function (Blueprint $table) {
            $table->foreignUuid('pickup_address_id')
                ->nullable()
                ->after('order_id')
                ->constrained('addresses')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('seller_pickup_request_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pickup_address_id');
        });
    }
};
