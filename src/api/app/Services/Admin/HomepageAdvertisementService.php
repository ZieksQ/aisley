<?php

namespace App\Services\Admin;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\AdminAuditAction;
use App\Enums\HomepageAdvertisementLayout;
use App\Enums\HomepageAdvertisementStatus;
use App\Enums\HomepageCampaignPlacement;
use App\Models\HomepageAdvertisementConfiguration;
use App\Models\HomepageCampaign;
use App\Models\User;
use App\Services\Audit\AuditService;
use App\Support\SafeHomepageDestination;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class HomepageAdvertisementService
{
    public function __construct(private readonly AuditService $audit) {}

    public function create(User $admin, array $data, array $context): HomepageAdvertisementConfiguration
    {
        return DB::transaction(function () use ($admin, $data, $context) {
            $configuration = HomepageAdvertisementConfiguration::create([...collect($data)->except('ads')->all(), 'status' => HomepageAdvertisementStatus::Draft, 'created_by_admin_id' => $admin->id]);
            $this->sync($configuration, $data['ads']);
            $this->record($admin, AdminAuditAction::HomepageAdvertisementDraftCreated, $configuration, $context);

            return $configuration;
        });
    }

    public function update(User $admin, HomepageAdvertisementConfiguration $configuration, array $data, array $context): HomepageAdvertisementConfiguration
    {
        return DB::transaction(function () use ($admin, $configuration, $data, $context) {
            $locked = HomepageAdvertisementConfiguration::query()->with('campaigns')->lockForUpdate()->findOrFail($configuration->id);
            $this->editable($locked, $data['revision']);
            $locked->update([...collect($data)->except(['ads', 'revision'])->all(), 'revision' => $locked->revision + 1]);
            $this->sync($locked, $data['ads']);
            $this->record($admin, AdminAuditAction::HomepageAdvertisementDraftUpdated, $locked, $context);

            return $locked;
        });
    }

    public function publish(User $admin, HomepageAdvertisementConfiguration $configuration, int $revision, array $context): HomepageAdvertisementConfiguration
    {
        $result = DB::transaction(function () use ($admin, $configuration, $revision, $context) {
            $locked = HomepageAdvertisementConfiguration::query()->with('campaigns')->lockForUpdate()->findOrFail($configuration->id);
            $this->editable($locked, $revision);
            $this->assertComplete($locked);
            HomepageAdvertisementConfiguration::query()->where('status', HomepageAdvertisementStatus::Published)->lockForUpdate()->update(['status' => HomepageAdvertisementStatus::Archived]);
            $locked->update(['status' => HomepageAdvertisementStatus::Published, 'published_by_admin_id' => $admin->id, 'published_at' => now(), 'revision' => $locked->revision + 1]);
            $this->record($admin, AdminAuditAction::HomepageAdvertisementPublished, $locked, $context);

            return $locked;
        });
        Cache::forget(HomepageAdvertisementConfiguration::ACTIVE_CACHE_KEY);

        return $result;
    }

    public function destroy(User $admin, HomepageAdvertisementConfiguration $configuration, int $revision, array $context): void
    {
        DB::transaction(function () use ($admin, $configuration, $revision, $context): void {
            $locked = HomepageAdvertisementConfiguration::query()->with('campaigns')->lockForUpdate()->findOrFail($configuration->id);
            $this->deletable($locked, $revision);
            $this->record($admin, $locked->status === HomepageAdvertisementStatus::Archived ? AdminAuditAction::HomepageAdvertisementArchivedDeleted : AdminAuditAction::HomepageAdvertisementDraftDeleted, $locked, $context);
            $locked->campaigns()->delete();
            $locked->delete();
        });
    }

    public function successor(User $admin, HomepageAdvertisementConfiguration $configuration, array $context): HomepageAdvertisementConfiguration
    {
        return DB::transaction(function () use ($admin, $configuration, $context) {
            $source = HomepageAdvertisementConfiguration::query()->with('campaigns')->lockForUpdate()->findOrFail($configuration->id);
            if ($source->status !== HomepageAdvertisementStatus::Published) {
                throw new ConflictHttpException('Only published configurations can be copied into a draft.');
            }
            $draft = HomepageAdvertisementConfiguration::create(['source_configuration_id' => $source->id, 'tag_title' => $source->tag_title, 'layout' => $source->layout, 'rotation_interval_seconds' => $source->rotation_interval_seconds, 'starts_at' => $source->starts_at, 'ends_at' => $source->ends_at, 'status' => HomepageAdvertisementStatus::Draft, 'created_by_admin_id' => $admin->id]);
            foreach ($source->campaigns as $ad) {
                $draft->campaigns()->create(collect($ad->getAttributes())->except(['id', 'homepage_advertisement_configuration_id', 'created_at', 'updated_at'])->all());
            }
            $this->record($admin, AdminAuditAction::HomepageAdvertisementDraftCreated, $draft, $context);

            return $draft;
        });
    }

    private function sync(HomepageAdvertisementConfiguration $configuration, array $ads): void
    {
        $ids = [];
        foreach ($ads as $index => $ad) {
            $model = ! empty($ad['id']) ? $configuration->campaigns()->findOrFail($ad['id']) : new HomepageCampaign(['homepage_advertisement_configuration_id' => $configuration->id]);
            $disk = $model->exists ? $model->image_disk : HomepageAdvertisementImageService::disk();
            $desktopPath = HomepageAdvertisementImageService::assertStoredPath($ad['image_desktop_path'], $disk, "ads.{$index}.image_desktop_path");
            $mobilePath = ($ad['image_mobile_path'] ?? null) ?: $desktopPath;
            HomepageAdvertisementImageService::assertStoredPath($mobilePath, $disk, "ads.{$index}.image_mobile_path");
            $desktopFilename = HomepageAdvertisementImageService::displayFilename((string) ($ad['image_desktop_filename'] ?? basename($desktopPath)));
            $mobileFilename = ($ad['image_mobile_path'] ?? null)
                ? HomepageAdvertisementImageService::displayFilename((string) ($ad['image_mobile_filename'] ?? basename($mobilePath)))
                : $desktopFilename;

            $model->fill([
                'placement' => $ad['slot'] === 'primary' ? HomepageCampaignPlacement::Hero : HomepageCampaignPlacement::HeroSide,
                'slot' => $ad['slot'],
                'position' => $ad['position'],
                'image_disk' => $disk,
                'image_desktop_path' => $desktopPath,
                'image_desktop_filename' => $desktopFilename,
                'image_mobile_path' => $mobilePath,
                'image_mobile_filename' => $mobileFilename,
                'destination_url' => SafeHomepageDestination::sanitize($ad['destination_url'] ?? null),
                'is_active' => $ad['is_active'],
                'priority' => 0,
            ]);
            // These shared legacy Campaign columns are not part of image-only advertisement authoring.
            $model->title = null;
            $model->description = null;
            $model->alt_text = null;
            $model->starts_at = null;
            $model->ends_at = null;
            $model->save();
            $ids[] = $model->id;
        }
        $configuration->campaigns()->whereNotIn('id', $ids)->delete();
    }

    private function editable(HomepageAdvertisementConfiguration $configuration, int $revision): void
    {
        if ($configuration->revision !== $revision) {
            throw new ConflictHttpException('This advertisement changed in another session. Refresh and review the latest version.');
        } if ($configuration->status !== HomepageAdvertisementStatus::Draft) {
            throw new ConflictHttpException('Published advertisements are immutable. Create a draft copy to edit.');
        }
    }

    private function deletable(HomepageAdvertisementConfiguration $configuration, int $revision): void
    {
        if ($configuration->revision !== $revision) {
            throw new ConflictHttpException('This advertisement changed in another session. Refresh and review the latest version.');
        }

        if (! in_array($configuration->status, [HomepageAdvertisementStatus::Draft, HomepageAdvertisementStatus::Archived], true)) {
            throw new ConflictHttpException('Published advertisements cannot be removed. Publish a replacement first.');
        }
    }

    private function assertComplete(HomepageAdvertisementConfiguration $configuration): void
    {
        $primary = $configuration->campaigns->where('slot', 'primary')->count();
        $top = $configuration->campaigns->where('slot', 'secondary_top')->count();
        $bottom = $configuration->campaigns->where('slot', 'secondary_bottom')->count();
        $valid = match ($configuration->layout) {
            HomepageAdvertisementLayout::Single => $primary === 1 && $top === 0 && $bottom === 0,
            HomepageAdvertisementLayout::Carousel => $primary >= 2 && $top === 0 && $bottom === 0,
            HomepageAdvertisementLayout::MultiBlock => $primary === 1 && $top === 1 && $bottom === 1,
            HomepageAdvertisementLayout::MultiBlockCarousel => $primary >= 2 && $top === 1 && $bottom === 1,
        };

        if (! $valid) {
            throw new UnprocessableEntityHttpException('Add exactly the required primary, secondary top, and secondary bottom advertisements before publishing.');
        }
    }

    private function record(User $admin, AdminAuditAction $action, HomepageAdvertisementConfiguration $target, array $context): void
    {
        $this->audit->record(actor: $admin, action: $action, sourceFeature: AuditSourceFeature::PlatformSettings, target: $target, targetSnapshot: ['id' => $target->id], metadata: ['layout' => $target->layout->value], ipAddress: $context['ip_address'] ?? null, userAgent: $context['user_agent'] ?? null, requestId: $context['request_id'] ?? null);
    }
}
