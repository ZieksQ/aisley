<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                CREATE OR REPLACE FUNCTION prevent_support_ticket_event_mutation() RETURNS trigger AS $$
                BEGIN
                    RAISE EXCEPTION 'support_ticket_events is append-only';
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER support_ticket_events_append_only
                BEFORE UPDATE OR DELETE ON support_ticket_events
                FOR EACH ROW EXECUTE FUNCTION prevent_support_ticket_event_mutation();
            SQL);
        }

        if (DB::getDriverName() === 'sqlite') {
            DB::unprepared(<<<'SQL'
                CREATE TRIGGER support_ticket_events_prevent_update
                BEFORE UPDATE ON support_ticket_events
                BEGIN
                    SELECT RAISE(ABORT, 'support_ticket_events is append-only');
                END;

                CREATE TRIGGER support_ticket_events_prevent_delete
                BEFORE DELETE ON support_ticket_events
                BEGIN
                    SELECT RAISE(ABORT, 'support_ticket_events is append-only');
                END;
            SQL);
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared(<<<'SQL'
                DROP TRIGGER IF EXISTS support_ticket_events_append_only ON support_ticket_events;
                DROP FUNCTION IF EXISTS prevent_support_ticket_event_mutation();
            SQL);
        }

        if (DB::getDriverName() === 'sqlite') {
            DB::unprepared(<<<'SQL'
                DROP TRIGGER IF EXISTS support_ticket_events_prevent_update;
                DROP TRIGGER IF EXISTS support_ticket_events_prevent_delete;
            SQL);
        }
    }
};
