<?php

use App\Enums\UserRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_reset_tokens_scoped', function (Blueprint $table) {
            $table->string('email');
            $table->string('role', 32);
            $table->string('token');
            $table->timestamp('created_at')->nullable();

            $table->primary(['email', 'role']);
        });

        DB::table('password_reset_tokens')
            ->orderBy('email')
            ->each(function (object $reset): void {
                DB::table('password_reset_tokens_scoped')->insert([
                    'email' => $reset->email,
                    'role' => UserRole::Customer->value,
                    'token' => $reset->token,
                    'created_at' => $reset->created_at,
                ]);
            });

        Schema::drop('password_reset_tokens');
        Schema::rename('password_reset_tokens_scoped', 'password_reset_tokens');
    }

    public function down(): void
    {
        Schema::create('password_reset_tokens_unscoped', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        DB::table('password_reset_tokens')
            ->where('role', UserRole::Customer->value)
            ->orderBy('email')
            ->each(function (object $reset): void {
                DB::table('password_reset_tokens_unscoped')->insert([
                    'email' => $reset->email,
                    'token' => $reset->token,
                    'created_at' => $reset->created_at,
                ]);
            });

        Schema::drop('password_reset_tokens');
        Schema::rename('password_reset_tokens_unscoped', 'password_reset_tokens');
    }
};
