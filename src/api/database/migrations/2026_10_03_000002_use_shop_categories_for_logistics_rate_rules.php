<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('logistics_rate_rules', function (Blueprint $table): void {
            $table->uuid('category_id')->nullable()->change();
            $table->foreignUuid('shop_category_id')->nullable()->constrained('shop_categories')->restrictOnDelete();
            $table->unique(
                ['logistics_rate_card_id', 'shop_category_id', 'service_type'],
                'logistics_rate_rule_shop_category_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::table('logistics_rate_rules', function (Blueprint $table): void {
            $table->dropUnique('logistics_rate_rule_shop_category_unique');
            $table->dropConstrainedForeignId('shop_category_id');
        });

        // category_id stays nullable because new Shop Category rules have no Product Category ID to restore.
    }
};
