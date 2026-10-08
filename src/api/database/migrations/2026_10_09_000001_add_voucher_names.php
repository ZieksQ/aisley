<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vouchers', fn (Blueprint $table) => $table->string('name', 120)->nullable());
        Schema::table('order_vouchers', fn (Blueprint $table) => $table->string('name', 120)->nullable());
        DB::table('vouchers')->update(['name' => DB::raw('code')]);
        // Keep historical version JSON and Orders intact; their name falls back to code.
    }

    public function down(): void
    {
        Schema::table('order_vouchers', fn (Blueprint $table) => $table->dropColumn('name'));
        Schema::table('vouchers', fn (Blueprint $table) => $table->dropColumn('name'));
    }
};
