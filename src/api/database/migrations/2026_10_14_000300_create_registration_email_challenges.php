<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registration_email_identities', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('email');
            $table->string('role');
            $table->timestampsTz();
            $table->unique(['email', 'role']);
        });
        Schema::create('registration_email_challenges', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('identity_id')->constrained('registration_email_identities')->cascadeOnDelete();
            $table->string('code_hash')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestampTz('expires_at');
            $table->timestampTz('verified_at')->nullable();
            $table->timestampTz('verification_expires_at')->nullable();
            $table->string('token_hash', 64)->nullable()->unique();
            $table->text('token')->nullable();
            $table->timestampTz('invalidated_at')->nullable();
            $table->timestampTz('consumed_at')->nullable();
            $table->timestampsTz();
            $table->index(['identity_id', 'created_at']);
        });
        Schema::table('transactional_emails', function (Blueprint $table): void {
            $table->uuid('user_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Registration emails cannot have a User before registration completes.
        // Leave nullable ownership in place to preserve delivery history on rollback.
        Schema::dropIfExists('registration_email_challenges');
        Schema::dropIfExists('registration_email_identities');
    }
};
