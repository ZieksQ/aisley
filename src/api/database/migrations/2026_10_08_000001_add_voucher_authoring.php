<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vouchers', function (Blueprint $table) {
            $table->string('lifecycle')->default('published');
            $table->unsignedInteger('revision')->default(1);
            $table->unsignedInteger('availability_revision')->default(1);
            $table->uuid('draft_version_id')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('ended_at')->nullable();
        });
        Schema::create('voucher_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('voucher_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('number');
            $table->string('state');
            $table->json('terms');
            $table->foreignUuid('actor_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->unique(['voucher_id', 'number']);
        });
        Schema::create('voucher_actions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('voucher_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('actor_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->string('action');
            $table->unsignedInteger('revision');
            $table->json('details');
            $table->timestamp('created_at');
            $table->index(['voucher_id', 'created_at']);
        });
        Schema::create('voucher_mutation_receipts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('actor_id')->constrained('users')->restrictOnDelete();
            $table->uuid('key');
            $table->string('payload_hash', 64);
            $table->json('response')->nullable();
            $table->timestamp('created_at');
            $table->unique(['actor_id', 'key']);
        });
        $fields = ['code', 'benefit_type', 'value_type', 'value', 'maximum_discount', 'minimum_spend', 'starts_at', 'ends_at', 'global_limit', 'per_customer_limit', 'payment_method', 'eligibility_rules', 'stacking_policy', 'terms_summary'];
        DB::table('vouchers')->orderBy('id')->chunk(200, function ($rows) use ($fields) {
            foreach ($rows as $row) {
                $terms = array_intersect_key((array) $row, array_flip($fields));
                foreach (['eligibility_rules', 'stacking_policy'] as $field) {
                    $terms[$field] = json_decode($terms[$field] ?? 'null', true);
                }
                foreach (['starts_at', 'ends_at'] as $field) {
                    $terms[$field] = CarbonImmutable::parse($terms[$field], 'UTC')->toISOString();
                }
                DB::table('voucher_versions')->insert([
                    'id' => (string) Str::uuid(), 'voucher_id' => $row->id, 'number' => $row->version,
                    'state' => 'published', 'terms' => json_encode($terms), 'actor_id' => null,
                    'published_at' => $row->created_at, 'created_at' => $row->created_at, 'updated_at' => $row->updated_at,
                ]);
                DB::table('vouchers')->where('id', $row->id)->update(['published_at' => $row->created_at]);
                DB::table('voucher_actions')->insert([
                    'id' => (string) Str::uuid(), 'voucher_id' => $row->id, 'actor_id' => null,
                    'action' => 'baseline_import', 'revision' => 1, 'details' => json_encode(['version' => $row->version]), 'created_at' => now(),
                ]);
            }
        });
        foreach (['view' => 'View voucher terms and redemption reports.', 'manage' => 'Create, revise, publish and control platform vouchers.'] as $suffix => $description) {
            DB::table('permissions')->insertOrIgnore([
                'id' => (string) Str::uuid(), 'name' => ucfirst($suffix).' vouchers', 'slug' => 'vouchers.'.$suffix,
                'description' => $description, 'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_mutation_receipts');
        Schema::dropIfExists('voucher_actions');
        Schema::dropIfExists('voucher_versions');
        Schema::table('vouchers', fn (Blueprint $table) => $table->dropColumn(['lifecycle', 'revision', 'availability_revision', 'draft_version_id', 'published_at', 'ended_at']));
    }
};
