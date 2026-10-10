<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            // Legacy platform offers retain access. New authoring supplies its own default.
            $table->string('distribution_mode')->default('automatic');
            $table->index(['lifecycle', 'ends_at', 'id']);
        });
        DB::table('vouchers')->where('issuer_type', 'shop')->update(['distribution_mode' => 'claim_required']);
        Schema::create('voucher_claims', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained('users')->restrictOnDelete();
            $table->foreignUuid('voucher_id')->constrained()->restrictOnDelete();
            $table->timestamp('collected_at');
            $table->unique(['customer_id', 'voucher_id']);
            $table->index(['voucher_id', 'customer_id']);
        });
        // Historical version JSON and placed Order snapshots remain untouched.
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_claims');
        Schema::table('vouchers', function (Blueprint $table) {
            $table->dropIndex(['lifecycle', 'ends_at', 'id']);
            $table->dropColumn('distribution_mode');
        });
    }
};
