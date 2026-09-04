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
            $this->editable($locked, $revision); $this->assertComplete($locked);
            HomepageAdvertisementConfiguration::query()->where('status', HomepageAdvertisementStatus::Published)->lockForUpdate()->update(['status' => HomepageAdvertisementStatus::Archived]);
            $locked->update(['status' => HomepageAdvertisementStatus::Published, 'published_by_admin_id' => $admin->id, 'published_at' => now(), 'revision' => $locked->revision + 1]);
            $this->record($admin, AdminAuditAction::HomepageAdvertisementPublished, $locked, $context);
            return $locked;
        });
        Cache::forget(HomepageAdvertisementConfiguration::ACTIVE_CACHE_KEY); return $result;
    }
    public function successor(User $admin, HomepageAdvertisementConfiguration $configuration, array $context): HomepageAdvertisementConfiguration
    {
        return DB::transaction(function () use ($admin, $configuration, $context) {
            $source = HomepageAdvertisementConfiguration::query()->with('campaigns')->lockForUpdate()->findOrFail($configuration->id);
            if ($source->status !== HomepageAdvertisementStatus::Published) throw new ConflictHttpException('Only published configurations can be copied into a draft.');
            $draft = HomepageAdvertisementConfiguration::create(['source_configuration_id' => $source->id, 'layout' => $source->layout, 'rotation_interval_seconds' => $source->rotation_interval_seconds, 'status' => HomepageAdvertisementStatus::Draft, 'created_by_admin_id' => $admin->id]);
            foreach ($source->campaigns as $ad) { $draft->campaigns()->create(collect($ad->getAttributes())->except(['id', 'homepage_advertisement_configuration_id', 'created_at', 'updated_at'])->all()); }
            $this->record($admin, AdminAuditAction::HomepageAdvertisementDraftCreated, $draft, $context); return $draft;
        });
    }
    private function sync(HomepageAdvertisementConfiguration $configuration, array $ads): void
    {
        $ids = [];
        foreach ($ads as $ad) {
            $model = !empty($ad['id']) ? $configuration->campaigns()->findOrFail($ad['id']) : new HomepageCampaign(['homepage_advertisement_configuration_id' => $configuration->id]);
            $model->fill([...$ad, 'placement' => $ad['slot'] === 'primary' ? HomepageCampaignPlacement::Hero : HomepageCampaignPlacement::HeroSide, 'image_disk' => 'public', 'priority' => 0]);
            $model->image_mobile_path = $ad['image_mobile_path'] ?: $ad['image_desktop_path']; $model->save(); $ids[] = $model->id;
        }
        $configuration->campaigns()->whereNotIn('id', $ids)->delete();
    }
    private function editable(HomepageAdvertisementConfiguration $configuration, int $revision): void { if ($configuration->revision !== $revision) throw new ConflictHttpException('This advertisement changed in another session. Refresh and review the latest version.'); if ($configuration->status !== HomepageAdvertisementStatus::Draft) throw new ConflictHttpException('Published advertisements are immutable. Create a draft copy to edit.'); }
    private function assertComplete(HomepageAdvertisementConfiguration $configuration): void { $primary = $configuration->campaigns->where('slot', 'primary')->count(); $side = $configuration->campaigns->whereIn('slot', ['secondary_top', 'secondary_bottom'])->count(); $valid = match ($configuration->layout) { HomepageAdvertisementLayout::Single => $primary === 1, HomepageAdvertisementLayout::Carousel => $primary >= 2, HomepageAdvertisementLayout::MultiBlock => $primary === 1 && $side === 2, HomepageAdvertisementLayout::MultiBlockCarousel => $primary >= 2 && $side === 2 }; if (!$valid) throw new UnprocessableEntityHttpException('Add all required advertisement slots before publishing.'); }
    private function record(User $admin, AdminAuditAction $action, HomepageAdvertisementConfiguration $target, array $context): void { $this->audit->record(actor: $admin, action: $action, sourceFeature: AuditSourceFeature::PlatformSettings, target: $target, targetSnapshot: ['id' => $target->id], metadata: ['layout' => $target->layout->value], ipAddress: $context['ip_address'] ?? null, userAgent: $context['user_agent'] ?? null, requestId: $context['request_id'] ?? null); }
}
