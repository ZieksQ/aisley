<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('logistics_hub_location_changes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('logistics_hub_id')->constrained('logistics_hubs')->cascadeOnDelete();
            $table->foreignUuid('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('previous_latitude', 10, 7)->nullable();
            $table->decimal('previous_longitude', 10, 7)->nullable();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->text('reason');
            $table->timestamp('created_at');

            $table->index(['logistics_hub_id', 'created_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                CREATE OR REPLACE FUNCTION prevent_logistics_hub_location_changes_mutation() RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'logistics_hub_location_changes is append-only';
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS logistics_hub_location_changes_append_only ON logistics_hub_location_changes;
                CREATE TRIGGER logistics_hub_location_changes_append_only
                BEFORE UPDATE OR DELETE ON logistics_hub_location_changes
                FOR EACH ROW EXECUTE FUNCTION prevent_logistics_hub_location_changes_mutation();
            SQL);
        }

        if (DB::getDriverName() === 'sqlite') {
            DB::unprepared(<<<'SQL'
                DROP TRIGGER IF EXISTS logistics_hub_location_changes_prevent_update;
                DROP TRIGGER IF EXISTS logistics_hub_location_changes_prevent_delete;
                CREATE TRIGGER logistics_hub_location_changes_prevent_update
                BEFORE UPDATE ON logistics_hub_location_changes
                BEGIN
                    SELECT RAISE(ABORT, 'logistics_hub_location_changes is append-only');
                END;

                CREATE TRIGGER logistics_hub_location_changes_prevent_delete
                BEFORE DELETE ON logistics_hub_location_changes
                BEGIN
                    SELECT RAISE(ABORT, 'logistics_hub_location_changes is append-only');
                END;
            SQL);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DROP TRIGGER IF EXISTS logistics_hub_location_changes_append_only ON logistics_hub_location_changes;
                DROP FUNCTION IF EXISTS prevent_logistics_hub_location_changes_mutation();
            SQL);
        }

        if (DB::getDriverName() === 'sqlite') {
            DB::unprepared(<<<'SQL'
                DROP TRIGGER IF EXISTS logistics_hub_location_changes_prevent_update;
                DROP TRIGGER IF EXISTS logistics_hub_location_changes_prevent_delete;
            SQL);
        }

        Schema::dropIfExists('logistics_hub_location_changes');
    }
};
