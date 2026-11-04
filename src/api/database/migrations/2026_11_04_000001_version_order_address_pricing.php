<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_pricing_snapshots', function (Blueprint $table): void {
            $table->dropUnique(['order_id']);
            $table->unsignedInteger('version')->default(1);
            $table->unsignedInteger('address_version')->default(1);
            $table->unique(['order_id', 'version']);
        });
        Schema::create('order_modification_quotes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('order_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('address_id')->constrained('addresses')->cascadeOnDelete();
            $table->unsignedInteger('expected_revision');
            $table->string('state_hash', 64);
            $table->timestamp('expires_at');
            $table->timestamps();
            $table->index(['customer_id', 'order_id']);
        });
    }

    public function down(): void
    {
        if (DB::table('order_pricing_snapshots')->where('version', '>', 1)->exists()) {
            throw new RuntimeException('Committed pricing revisions require a forward migration; history must be preserved.');
        }
        Schema::dropIfExists('order_modification_quotes');
        Schema::table('order_pricing_snapshots', function (Blueprint $table): void {
            $table->dropUnique(['order_id', 'version']);
            $table->dropColumn(['version', 'address_version']);
            $table->unique('order_id');
        });
    }
};
