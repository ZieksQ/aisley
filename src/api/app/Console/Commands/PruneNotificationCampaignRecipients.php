<?php

namespace App\Console\Commands;

use App\Enums\Admin\NotificationCampaignStatus;
use App\Models\NotificationCampaignRecipient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PruneNotificationCampaignRecipients extends Command
{
    protected $signature = 'campaigns:prune-recipients';

    protected $description = 'Remove per-recipient campaign records 90 days after completion.';

    public function handle(): int
    {
        $deleted = 0;
        NotificationCampaignRecipient::query()
            ->whereHas('campaign', fn ($query) => $query
                ->whereIn('status', [NotificationCampaignStatus::Completed, NotificationCampaignStatus::PartiallyFailed, NotificationCampaignStatus::Failed])
                ->where('completed_at', '<=', now()->subDays(90)))
            ->orderBy('id')->chunkById(500, function ($recipients) use (&$deleted): void {
                $ids = $recipients->pluck('id')->all();
                $deleted += DB::table('notification_campaign_recipients')->whereIn('id', $ids)->delete();
            });

        $this->info("Pruned {$deleted} campaign recipient record(s); aggregate campaign history was retained.");

        return self::SUCCESS;
    }
}
