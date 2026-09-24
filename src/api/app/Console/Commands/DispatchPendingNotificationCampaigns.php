<?php

namespace App\Console\Commands;

use App\Enums\Admin\NotificationCampaignRecipientStatus;
use App\Enums\Admin\NotificationCampaignStatus;
use App\Jobs\Admin\ProcessNotificationCampaign;
use App\Models\NotificationCampaign;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

class DispatchPendingNotificationCampaigns extends Command
{
    protected $signature = 'campaigns:dispatch-pending';

    protected $description = 'Redispatch queued or retryable Customer notification campaigns.';

    public function handle(): int
    {
        $campaigns = NotificationCampaign::query()
            ->whereIn('status', [
                NotificationCampaignStatus::Queued,
                NotificationCampaignStatus::Sending,
                NotificationCampaignStatus::PartiallyFailed,
                NotificationCampaignStatus::Failed,
            ])
            ->whereHas('recipients', function ($query): void {
                $query->where('status', NotificationCampaignRecipientStatus::Pending)
                    ->orWhere(function ($failed): void {
                        $failed->where('status', NotificationCampaignRecipientStatus::Failed)
                            ->where('attempt_count', '<', 3)
                            ->where('updated_at', '<=', now()->subMinutes(5));
                    });
            })
            ->orderBy('created_at')->limit(25)->pluck('id');

        foreach ($campaigns as $campaignId) {
            try {
                ProcessNotificationCampaign::dispatch($campaignId);
            } catch (Throwable $exception) {
                Log::warning('Campaign redispatch failed', ['campaign_id' => $campaignId, 'category' => $exception::class]);
            }
        }

        $this->info("Dispatched {$campaigns->count()} campaign(s).");

        return self::SUCCESS;
    }
}
