<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('is_super_admin')->default(false);
            $table->boolean('is_initial_admin')->default(false);
            $table->boolean('admin_setup_required')->default(false);
            $table->boolean('admin_email_verification_required')->default(false);
            $table->unsignedInteger('admin_session_version')->default(0);
            $table->unsignedInteger('admin_revision')->default(0);
            $table->timestamp('admin_archived_at')->nullable();
        });
        Schema::create('admin_authority_locks', function (Blueprint $table): void {
            $table->unsignedInteger('id')->primary();
        });
        DB::table('admin_authority_locks')->insert(['id' => 1]);
        Schema::create('admin_roles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name')->unique();
            $table->unsignedInteger('revision')->default(0);
            $table->timestamps();
        });
        Schema::create('admin_role_permissions', function (Blueprint $table): void {
            $table->foreignUuid('admin_role_id')->constrained('admin_roles')->cascadeOnDelete();
            $table->foreignUuid('permission_id')->constrained()->cascadeOnDelete();
            $table->primary(['admin_role_id', 'permission_id']);
        });
        Schema::create('admin_role_memberships', function (Blueprint $table): void {
            $table->foreignUuid('admin_role_id')->constrained('admin_roles')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->primary(['admin_role_id', 'user_id']);
        });
        Schema::create('admin_setup_challenges', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('identity_fingerprint');
            $table->string('replacement_fingerprint')->nullable();
            $table->string('code_hash');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->timestamp('invalidated_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_setup_challenges');
        Schema::dropIfExists('admin_role_memberships');
        Schema::dropIfExists('admin_role_permissions');
        Schema::dropIfExists('admin_roles');
        Schema::dropIfExists('admin_authority_locks');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn([
            'is_super_admin', 'is_initial_admin', 'admin_setup_required',
            'admin_email_verification_required', 'admin_session_version', 'admin_revision', 'admin_archived_at',
        ]));
    }
};
