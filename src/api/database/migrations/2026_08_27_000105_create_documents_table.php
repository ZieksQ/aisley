<?php

use App\Enums\DocumentStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('registration_application_id')
                ->nullable()
                ->constrained()
                ->cascadeOnDelete();
            $table->foreignUuid('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 64);
            $table->string('status', 32)->default(DocumentStatus::Pending->value);
            $table->string('disk');
            $table->text('path');
            $table->string('original_name');
            $table->string('mime_type', 127);
            $table->unsignedBigInteger('size_bytes');
            $table->string('checksum', 128)->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'type']);
            $table->index(['registration_application_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
