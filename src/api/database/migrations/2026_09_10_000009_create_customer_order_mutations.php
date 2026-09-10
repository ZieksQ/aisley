<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_addresses', function (Blueprint $table): void {
            $table->unsignedInteger('version')->default(1)->after('order_id');
        });

        Schema::table('order_addresses', function (Blueprint $table): void {
            $table->dropUnique('order_addresses_order_id_unique');
            $table->unique(['order_id', 'version'], 'order_addresses_order_version_unique');
        });

        Schema::create('customer_order_cancellations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->unique()->constrained('orders')->restrictOnDelete();
            $table->foreignUuid('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('status_event_id')->unique()->constrained('order_status_events')->restrictOnDelete();
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->text('reason')->nullable();
            $table->timestamps();

            $table->unique(['customer_id', 'idempotency_key']);
            $table->index(['order_id', 'created_at']);
        });

        Schema::create('customer_order_modifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained('orders')->restrictOnDelete();
            $table->foreignUuid('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('status_event_id')->unique()->constrained('order_status_events')->restrictOnDelete();
            $table->foreignUuid('previous_address_id')->constrained('order_addresses')->restrictOnDelete();
            $table->foreignUuid('new_address_id')->constrained('order_addresses')->restrictOnDelete();
            $table->string('change_type', 64);
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->unsignedInteger('expected_revision')->nullable();
            $table->timestamps();

            $table->unique(['customer_id', 'idempotency_key']);
            $table->index(['order_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_order_modifications');
        Schema::dropIfExists('customer_order_cancellations');

        Schema::table('order_addresses', function (Blueprint $table): void {
            $table->dropUnique('order_addresses_order_version_unique');
            $table->dropColumn('version');
            $table->unique('order_id');
        });
    }
};
