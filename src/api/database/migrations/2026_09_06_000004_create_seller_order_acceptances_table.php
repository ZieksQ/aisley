<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_order_acceptances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('seller_id')->constrained('users')->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->foreignUuid('status_event_id')->unique()->constrained('order_status_events')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['seller_id', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_order_acceptances');
    }
};
