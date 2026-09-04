<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('homepage_campaigns', function (Blueprint $table) {
            $table->string('title')->nullable()->change();
            $table->string('alt_text')->nullable()->change();
            $table->text('destination_url')->nullable()->change();
            $table->timestamp('starts_at')->nullable()->change();
            $table->timestamp('ends_at')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Optional values cannot be made required again without inventing content.
    }
};
