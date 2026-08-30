<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shop_categories', function (Blueprint $table) {
            $table->unsignedSmallInteger('position')->default(0)->after('status');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->foreignUuid('shop_category_id')
                ->nullable()
                ->after('parent_id')
                ->constrained('shop_categories')
                ->nullOnDelete();
            $table->unsignedSmallInteger('position')->default(0)->after('status');

            $table->index(['shop_category_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropForeign(['shop_category_id']);
            $table->dropIndex(['shop_category_id', 'status']);
            $table->dropColumn('shop_category_id');
            $table->dropColumn('position');
        });

        Schema::table('shop_categories', function (Blueprint $table) {
            $table->dropColumn('position');
        });
    }
};
