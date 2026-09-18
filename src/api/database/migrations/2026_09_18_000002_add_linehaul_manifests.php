<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('linehaul_manifests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('from_hub_id')->constrained('logistics_hubs')->restrictOnDelete();
            $table->foreignUuid('to_hub_id')->constrained('logistics_hubs')->restrictOnDelete();
            $table->foreignUuid('created_by')->constrained('users')->restrictOnDelete();
            $table->string('status')->default('in_transfer');
            $table->json('items');
            $table->string('request_hash', 64);
            $table->timestamp('received_at')->nullable();
            $table->timestamps();
        });
        Schema::table('shipment_route_hops', function (Blueprint $table): void {
            $table->foreignUuid('linehaul_manifest_id')->nullable()->constrained('linehaul_manifests')->restrictOnDelete();
        });
        Schema::table('hub_connections', function (Blueprint $table): void {
            $table->double('distance_meters')->nullable();
            $table->double('duration_seconds')->nullable();
        });
        DB::table('platform_feature_controls')->insertOrIgnore([
            'id' => (string) Str::uuid(), 'key' => 'linehaul', 'label' => 'Linehaul',
            'description' => 'Enable new linehaul routes and departures. Receiving manifests already in transit remains available when disabled.',
            'enabled' => true, 'revision' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::table('hub_connections', fn (Blueprint $table) => $table->dropColumn(['distance_meters', 'duration_seconds']));
        Schema::table('shipment_route_hops', fn (Blueprint $table) => $table->dropConstrainedForeignId('linehaul_manifest_id'));
        Schema::dropIfExists('linehaul_manifests');
        DB::table('platform_feature_controls')->where('key', 'linehaul')->delete();
    }
};
