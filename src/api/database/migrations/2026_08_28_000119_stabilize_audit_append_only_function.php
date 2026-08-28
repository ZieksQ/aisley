<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared(<<<'SQL'
            DROP FUNCTION IF EXISTS prevent_audit_logs_mutation_v1() CASCADE;
            ALTER FUNCTION prevent_audit_logs_mutation() RENAME TO prevent_audit_logs_mutation_v1;
        SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared(<<<'SQL'
            DROP FUNCTION IF EXISTS prevent_audit_logs_mutation() CASCADE;
            ALTER FUNCTION prevent_audit_logs_mutation_v1() RENAME TO prevent_audit_logs_mutation;
        SQL);
    }
};
