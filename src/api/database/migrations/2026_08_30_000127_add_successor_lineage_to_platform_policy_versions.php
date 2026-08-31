<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('platform_policy_versions', function (Blueprint $table) {
            $table->foreignUuid('source_policy_version_id')
                ->nullable()
                ->unique()
                ->after('platform_policy_id')
                ->constrained('platform_policy_versions')
                ->restrictOnDelete();
            $table->string('change_summary', 1000)->nullable()->after('content');
        });
    }

    public function down(): void
    {
        Schema::table('platform_policy_versions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_policy_version_id');
            $table->dropColumn('change_summary');
        });
    }
};
