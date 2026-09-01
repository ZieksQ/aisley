<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductDescriptionAsset;
use App\Models\ProductMedia;
use App\Models\ProductUpload;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class CleanupProductAssets extends Command
{
    protected $signature = 'products:cleanup-assets';

    protected $description = 'Remove expired temporary and retention-expired Seller Product blobs.';

    public function handle(): int
    {
        $deleted = 0;
        ProductUpload::where('expires_at', '<=', now())->chunkById(100, function ($uploads) use (&$deleted): void {
            foreach ($uploads as $upload) {
                Storage::disk($upload->disk)->delete($upload->path);
                $upload->delete();
                $deleted++;
            }
        });

        foreach ([ProductMedia::class, ProductDescriptionAsset::class] as $model) {
            $model::onlyTrashed()->where('purge_after', '<=', now())->chunkById(100, function ($assets) use (&$deleted): void {
                foreach ($assets as $asset) {
                    Storage::disk($asset->disk)->delete($asset->path);
                    $asset->forceDelete();
                    $deleted++;
                }
            });
        }

        Product::onlyTrashed()->where('purge_after', '<=', now())->update(['purge_after' => null]);
        $this->info("Removed {$deleted} expired Product asset(s).");

        return self::SUCCESS;
    }
}
