<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('completion_intents', function (Blueprint $table): void {
            $table->decimal('cod_declared_amount', 12, 2)->nullable();
            $table->string('cod_currency', 3)->nullable();
            $table->timestamp('cod_declared_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('completion_intents', function (Blueprint $table): void {
            $table->dropColumn(['cod_declared_amount', 'cod_currency', 'cod_declared_at']);
        });
    }
};
