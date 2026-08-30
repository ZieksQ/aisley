<?php

use App\Enums\AnnouncementStatus;
use App\Enums\PlatformPolicyVersionStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title', 160);
            $table->text('body');
            $table->string('status')->default(AnnouncementStatus::Draft->value);
            $table->unsignedInteger('revision')->default(1);
            $table->timestamp('published_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->foreignUuid('created_by_admin_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('updated_by_admin_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['status', 'published_at', 'expires_at']);
            $table->index(['created_by_admin_id', 'created_at']);
        });

        Schema::create('platform_policies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type')->unique();
            $table->uuid('current_version_id')->nullable()->unique();
            $table->timestamps();
        });

        Schema::create('platform_policy_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('platform_policy_id')->constrained('platform_policies')->restrictOnDelete();
            $table->unsignedInteger('version');
            $table->string('title', 200);
            $table->text('content');
            $table->string('status')->default(PlatformPolicyVersionStatus::Draft->value);
            $table->boolean('requires_reconsent')->default(false);
            $table->unsignedInteger('revision')->default(1);
            $table->foreignUuid('created_by_admin_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('published_by_admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->unique(['platform_policy_id', 'version']);
            $table->index(['platform_policy_id', 'status']);
        });

        Schema::table('platform_policies', function (Blueprint $table) {
            $table->foreign('current_version_id')
                ->references('id')
                ->on('platform_policy_versions')
                ->nullOnDelete();
        });

        Schema::create('policy_acceptances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('platform_policy_version_id')->constrained('platform_policy_versions')->restrictOnDelete();
            $table->timestamp('accepted_at');
            $table->timestamps();

            $table->unique(['user_id', 'platform_policy_version_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('policy_acceptances');
        Schema::table('platform_policies', function (Blueprint $table) {
            $table->dropForeign(['current_version_id']);
        });
        Schema::dropIfExists('platform_policy_versions');
        Schema::dropIfExists('platform_policies');
        Schema::dropIfExists('announcements');
    }
};
