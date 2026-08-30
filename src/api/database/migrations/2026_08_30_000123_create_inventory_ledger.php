<?php

use App\Enums\InventoryMovementType;
use App\Enums\InventorySkuStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventory_skus', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('product_id')->constrained()->restrictOnDelete();
            $table->foreignUuid('product_variant_id')->nullable()->unique()->constrained('product_variants')->restrictOnDelete();
            $table->string('code')->unique();
            $table->boolean('is_base')->default(false);
            $table->string('status')->default(InventorySkuStatus::Active->value);
            $table->timestamps();

            $table->index(['product_id', 'status']);
            $table->index(['product_id', 'is_base']);
        });

        Schema::create('inventory_balances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('inventory_sku_id')->unique()->constrained('inventory_skus')->restrictOnDelete();
            $table->unsignedBigInteger('on_hand')->default(0);
            $table->unsignedBigInteger('reserved')->default(0);
            $table->unsignedBigInteger('alert_threshold')->nullable();
            $table->timestamps();
        });

        Schema::create('inventory_movements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('inventory_balance_id')->constrained('inventory_balances')->restrictOnDelete();
            $table->string('movement_type');
            $table->bigInteger('on_hand_delta')->default(0);
            $table->bigInteger('reserved_delta')->default(0);
            $table->unsignedBigInteger('resulting_on_hand');
            $table->unsignedBigInteger('resulting_reserved');
            $table->string('reference_type')->nullable();
            $table->uuid('reference_id')->nullable();
            $table->string('idempotency_key')->nullable()->unique();
            $table->foreignUuid('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('reason')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['inventory_balance_id', 'created_at']);
            $table->index(['reference_type', 'reference_id']);
            $table->index('movement_type');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE inventory_skus ADD CONSTRAINT inventory_skus_target_check CHECK ((is_base = true AND product_variant_id IS NULL) OR (is_base = false AND product_variant_id IS NOT NULL))');
            DB::statement('ALTER TABLE inventory_balances ADD CONSTRAINT inventory_balances_nonnegative_check CHECK (on_hand >= 0 AND reserved >= 0 AND reserved <= on_hand)');
            DB::statement('ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_result_check CHECK (resulting_on_hand >= 0 AND resulting_reserved >= 0 AND resulting_reserved <= resulting_on_hand)');
        }

        $this->backfillCatalogStock();
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_movements');
        Schema::dropIfExists('inventory_balances');
        Schema::dropIfExists('inventory_skus');
    }

    private function backfillCatalogStock(): void
    {
        $now = now();

        DB::table('products')->orderBy('id')->each(function (object $product) use ($now): void {
            $variants = DB::table('product_variants')
                ->where('product_id', $product->id)
                ->orderBy('id')
                ->get();

            if ($variants->isEmpty()) {
                $this->insertSku(
                    (string) $product->id,
                    null,
                    'BASE-'.strtoupper(substr(str_replace('-', '', (string) $product->id), 0, 12)),
                    true,
                    (int) $product->stock_quantity,
                    $now,
                );

                return;
            }

            foreach ($variants as $variant) {
                $this->insertSku(
                    (string) $product->id,
                    (string) $variant->id,
                    (string) $variant->sku,
                    false,
                    (int) $variant->stock_quantity,
                    $now,
                );
            }
        });
    }

    private function insertSku(
        string $productId,
        ?string $variantId,
        string $code,
        bool $isBase,
        int $onHand,
        mixed $now,
    ): void {
        $skuId = (string) Str::uuid();
        $balanceId = (string) Str::uuid();

        DB::table('inventory_skus')->insert([
            'id' => $skuId,
            'product_id' => $productId,
            'product_variant_id' => $variantId,
            'code' => $code,
            'is_base' => $isBase,
            'status' => InventorySkuStatus::Active->value,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        DB::table('inventory_balances')->insert([
            'id' => $balanceId,
            'inventory_sku_id' => $skuId,
            'on_hand' => $onHand,
            'reserved' => 0,
            'alert_threshold' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        if ($onHand > 0) {
            DB::table('inventory_movements')->insert([
                'id' => (string) Str::uuid(),
                'inventory_balance_id' => $balanceId,
                'movement_type' => InventoryMovementType::Restock->value,
                'on_hand_delta' => $onHand,
                'reserved_delta' => 0,
                'resulting_on_hand' => $onHand,
                'resulting_reserved' => 0,
                'reference_type' => 'catalog_backfill',
                'reference_id' => null,
                'idempotency_key' => 'catalog-backfill-'.$skuId,
                'actor_id' => null,
                'reason' => 'Opening balance imported from the existing catalog.',
                'created_at' => $now,
            ]);
        }
    }
};
