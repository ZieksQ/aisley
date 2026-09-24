<?php

namespace App\Jobs\Admin;

use App\Enums\Admin\NotificationCampaignRecipientStatus;
use App\Models\NotificationCampaignRecipient;
use App\Services\Admin\NotificationCampaignService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProcessNotificationCampaign implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly string $campaignId) {}

    public function handle(NotificationCampaignService $campaigns): void
    {
        $recipients = NotificationCampaignRecipient::query()
            ->where('campaign_id', $this->campaignId)
            ->where(function ($query): void {
                $query->where('status', NotificationCampaignRecipientStatus::Pending)
                    ->orWhere(function ($failed): void {
                        $failed->where('status', NotificationCampaignRecipientStatus::Failed)
                            ->where('attempt_count', '<', 3)
                            ->where('updated_at', '<=', now()->subMinutes(5));
                    });
            })
            ->orderBy('id')->limit(200)->pluck('id');

        foreach ($recipients as $recipientId) {
            try {
                $campaigns->deliverRecipient($recipientId);
            } catch (Throwable $exception) {
                Log::warning('Campaign recipient delivery failed', [
                    'campaign_id' => $this->campaignId,
                    'category' => $exception::class,
                ]);
                $campaigns->markFailed($recipientId);
            }
        }

        $campaigns->reconcile($this->campaignId);

        if ($recipients->isNotEmpty() && NotificationCampaignRecipient::query()
            ->where('campaign_id', $this->campaignId)
            ->where('status', NotificationCampaignRecipientStatus::Pending)->exists()) {
            self::dispatch($this->campaignId);
        }
    }
}
