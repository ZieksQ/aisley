<?php

use App\Enums\Admin\AuditSourceFeature;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropForeign(['actor_id']);
            $table->string('source_feature', 64)
                ->default(AuditSourceFeature::AccountApproval->value)
                ->after('action');
            $table->string('actor_name')->nullable()->after('actor_id');
            $table->json('target_snapshot')->nullable()->after('auditable_id');
            $table->json('changed_fields')->nullable()->after('new_values');
            $table->json('metadata')->nullable()->after('changed_fields');
            $table->string('request_id', 64)->nullable()->after('metadata');
            $table->unsignedSmallInteger('schema_version')->default(1)->after('request_id');
            $table->timestamp('occurred_at')->nullable()->after('schema_version');

            $table->index(['source_feature', 'occurred_at'], 'audit_logs_feature_occurred_idx');
            $table->index(['actor_id', 'occurred_at'], 'audit_logs_actor_occurred_idx');
            $table->index('occurred_at', 'audit_logs_occurred_idx');
            $table->index('request_id', 'audit_logs_request_id_idx');
        });

        DB::table('audit_logs')
            ->whereNull('occurred_at')
            ->update(['occurred_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('audit_logs_feature_occurred_idx');
            $table->dropIndex('audit_logs_actor_occurred_idx');
            $table->dropIndex('audit_logs_occurred_idx');
            $table->dropIndex('audit_logs_request_id_idx');
            $table->dropColumn([
                'source_feature',
                'actor_name',
                'target_snapshot',
                'changed_fields',
                'metadata',
                'request_id',
                'schema_version',
                'occurred_at',
            ]);
            $table->foreign('actor_id')->references('id')->on('users')->nullOnDelete();
        });
    }
};
