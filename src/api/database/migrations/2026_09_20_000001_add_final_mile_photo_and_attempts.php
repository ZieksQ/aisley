<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipment_evidence', function (Blueprint $table): void {
            $table->string('storage_disk')->nullable();
            $table->string('storage_path')->nullable();
            $table->string('mime_type', 32)->nullable();
            $table->unsignedInteger('byte_size')->nullable();
            $table->unsignedInteger('image_width')->nullable();
            $table->unsignedInteger('image_height')->nullable();
            $table->string('sha256', 64)->nullable();
        });

        Schema::create('final_mile_failed_attempts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('delivery_task_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('courier_id')->constrained('users')->restrictOnDelete();
            $table->string('reason', 40);
            $table->text('note')->nullable();
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->timestamp('attempted_at');
            $table->timestamps();
            $table->unique(['courier_id', 'idempotency_key']);
            $table->index(['delivery_task_id', 'attempted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('final_mile_failed_attempts');
        Schema::table('shipment_evidence', function (Blueprint $table): void {
            $table->dropColumn(['storage_disk', 'storage_path', 'mime_type', 'byte_size', 'image_width', 'image_height', 'sha256']);
        });
    }
};
