<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $duplicates = DB::table('vehicles')
            ->select('courier_profile_id')
            ->groupBy('courier_profile_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('courier_profile_id')
            ->all();

        if ($duplicates !== []) {
            throw new RuntimeException('Cannot enforce one vehicle per Courier until duplicate vehicle rows are reconciled: '.implode(', ', $duplicates));
        }

        Schema::table('vehicles', function (Blueprint $table): void {
            $table->unsignedInteger('revision')->default(1)->after('status');
            $table->foreignUuid('official_receipt_document_id')
                ->nullable()
                ->after('registration_document_path')
                ->constrained('documents')
                ->nullOnDelete();
            $table->foreignUuid('certificate_of_registration_document_id')
                ->nullable()
                ->after('official_receipt_document_id')
                ->constrained('documents')
                ->nullOnDelete();
            $table->unique('courier_profile_id', 'vehicles_one_per_courier_unique');
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table): void {
            $table->dropUnique('vehicles_one_per_courier_unique');
            $table->dropForeign(['official_receipt_document_id']);
            $table->dropForeign(['certificate_of_registration_document_id']);
            $table->dropColumn([
                'revision',
                'official_receipt_document_id',
                'certificate_of_registration_document_id',
            ]);
        });
    }
};
