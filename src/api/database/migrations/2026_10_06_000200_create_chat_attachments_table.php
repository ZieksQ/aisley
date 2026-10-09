<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_attachments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('uploader_id')->constrained('users')->restrictOnDelete();
            $table->uuid('upload_key');
            $table->string('scope_hash', 64);
            $table->foreignUuid('conversation_id')->nullable()->constrained('conversations')->restrictOnDelete();
            $table->foreignUuid('message_id')->nullable()->constrained('messages')->restrictOnDelete();
            $table->unsignedSmallInteger('position')->nullable();
            $table->string('disk');
            $table->string('path');
            $table->string('preview_path')->nullable();
            $table->string('filename');
            $table->string('kind');
            $table->string('mime_type');
            $table->unsignedBigInteger('byte_size');
            $table->string('checksum', 64);
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->decimal('duration_seconds', 8, 3)->nullable();
            $table->string('state')->default('pending');
            $table->string('error_code')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('expires_at')->index();
            $table->timestamps();
            $table->unique(['uploader_id', 'upload_key']);
            $table->index(['message_id', 'position']);
            $table->index(['state', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_attachments');
    }
};
