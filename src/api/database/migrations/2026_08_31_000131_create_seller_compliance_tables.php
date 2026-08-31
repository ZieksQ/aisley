<?php

use App\Enums\SellerComplianceCaseStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('seller_compliance_cases', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('seller_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('product_id')->nullable()->constrained('products')->restrictOnDelete();
            $table->foreignUuid('policy_version_id')->nullable()->constrained('platform_policy_versions')->restrictOnDelete();
            $table->string('source_type')->default('manual_admin_review');
            $table->string('source_reference_id')->nullable();
            $table->text('reason');
            $table->string('status')->default(SellerComplianceCaseStatus::Open->value);
            $table->unsignedInteger('revision')->default(1);
            $table->foreignUuid('created_by_admin_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('dismissed_by_admin_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignUuid('closed_by_admin_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('dismissal_note')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('dismissed_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['seller_id', 'status']);
            $table->index(['product_id', 'status']);
            $table->index(['policy_version_id', 'status']);
        });

        Schema::create('product_compliance_restrictions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained('products')->restrictOnDelete();
            $table->foreignUuid('case_id')->constrained('seller_compliance_cases')->restrictOnDelete();
            $table->foreignUuid('policy_version_id')->nullable()->constrained('platform_policy_versions')->restrictOnDelete();
            $table->string('active_marker')->nullable()->default('active');
            $table->text('reason');
            $table->foreignUuid('imposed_by_admin_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('revoked_by_admin_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->text('revocation_reason')->nullable();
            $table->timestamp('imposed_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->unique(['product_id', 'active_marker'], 'product_active_compliance_restriction_unique');
            $table->index(['case_id', 'imposed_at']);
        });

        Schema::create('seller_compliance_actions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('case_id')->constrained('seller_compliance_cases')->restrictOnDelete();
            $table->string('action');
            $table->text('reason');
            $table->foreignUuid('acted_by_admin_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('restriction_id')->nullable()->constrained('product_compliance_restrictions')->restrictOnDelete();
            $table->foreignUuid('account_lifecycle_event_id')->nullable()->constrained('account_lifecycle_events')->restrictOnDelete();
            $table->uuid('idempotency_key')->unique();
            $table->timestamp('occurred_at');
            $table->timestamps();

            $table->index(['case_id', 'occurred_at']);
            $table->index(['action', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('seller_compliance_actions');
        Schema::dropIfExists('product_compliance_restrictions');
        Schema::dropIfExists('seller_compliance_cases');
    }
};
