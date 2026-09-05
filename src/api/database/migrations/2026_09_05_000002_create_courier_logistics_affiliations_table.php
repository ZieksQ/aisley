<?php

use App\Enums\CourierAffiliationStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('courier_logistics_affiliations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('courier_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->foreignUuid('logistics_organization_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('logistics_hub_id')->constrained()->restrictOnDelete();
            $table->string('status', 32)->default(CourierAffiliationStatus::Pending->value);
            $table->foreignUuid('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
            $table->index(['logistics_organization_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('courier_logistics_affiliations');
    }
};
