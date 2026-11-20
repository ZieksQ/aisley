<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_preparation_extensions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignUuid('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('status_event_id')->constrained('order_status_events')->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->timestampTz('approved_at');
            $table->timestampTz('deadline_at');
            $table->timestampsTz();
            $table->unique(['customer_id', 'idempotency_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_preparation_extensions');
    }
};
