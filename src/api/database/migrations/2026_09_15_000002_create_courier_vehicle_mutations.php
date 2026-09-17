<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courier_vehicle_mutations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('courier_id')->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->string('action', 64);
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->unsignedInteger('resulting_revision');
            $table->json('response');
            $table->timestamps();

            $table->unique(['courier_id', 'vehicle_id', 'action', 'idempotency_key'], 'courier_vehicle_mutation_idempotency_unique');
            $table->index(['vehicle_id', 'resulting_revision']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courier_vehicle_mutations');
    }
};
