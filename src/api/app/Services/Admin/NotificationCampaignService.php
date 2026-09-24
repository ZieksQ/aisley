<?php

namespace App\Services\Admin;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\Admin\NotificationCampaignRecipientStatus;
use App\Enums\Admin\NotificationCampaignStatus;
use App\Enums\AdminAuditAction;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\Admin\ProcessNotificationCampaign;
use App\Models\NotificationCampaign;
use App\Models\NotificationCampaignRecipient;
use App\Models\Product;
use App\Models\Shop;
use App\Models\User;
use App\Services\Audit\AuditService;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Ramsey\Uuid\Uuid;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Throwable;

class NotificationCampaignService
{
    public const MAX_RECIPIENTS = 10000;

    public function __construct(private readonly AuditService $audit) {}

    /** @param array<string, mixed> $data */
    public function create(User $admin, array $data, array $context): NotificationCampaign
    {
        return DB::transaction(function () use ($admin, $data, $context): NotificationCampaign {
            $campaign = NotificationCampaign::create([
                ...$this->content($data),
                'created_by_admin_id' => $admin->id,
                'status' => NotificationCampaignStatus::Draft,
            ]);
            $this->audit($admin, AdminAuditAction::NotificationCampaignCreated, $campaign, $context);

            return $campaign;
        });
    }

    /** @param array<string, mixed> $data */
    public function update(User $admin, NotificationCampaign $campaign, array $data, array $context): NotificationCampaign
    {
        return DB::transaction(function () use ($admin, $campaign, $data, $context): NotificationCampaign {
            $locked = NotificationCampaign::whereKey($campaign->id)->lockForUpdate()->firstOrFail();
            $this->assertDraftRevision($locked, (int) $data['revision']);
            $locked->update([
                ...$this->content($data),
                'revision' => $locked->revision + 1,
                'previewed_at' => null,
                'preview_revision' => null,
                'preview_eligible_count' => null,
            ]);
            $this->audit($admin, AdminAuditAction::NotificationCampaignUpdated, $locked, $context);

            return $locked;
        });
    }

    /** @return array<string, mixed> */
    public function preview(NotificationCampaign $campaign, int $revision): array
    {
        return DB::transaction(function () use ($campaign, $revision): array {
            $locked = NotificationCampaign::whereKey($campaign->id)->lockForUpdate()->firstOrFail();
            $this->assertDraftRevision($locked, $revision);
            $this->assertDestinationVisible($locked);
            $count = $this->eligibleCustomers(now())->count();
            $calculatedAt = now();
            $locked->update([
                'previewed_at' => $calculatedAt,
                'preview_revision' => $locked->revision,
                'preview_eligible_count' => $count,
            ]);

            return [
                'audience_key' => $locked->audience_key,
                'audience_label' => 'Customers opted in to in-app promotions',
                'eligible_count' => $count,
                'calculated_at' => $calculatedAt->toIso8601String(),
                'dispatch_allowed' => $count > 0 && $count <= self::MAX_RECIPIENTS,
                'revision' => $locked->revision,
            ];
        });
    }

    public function send(User $admin, NotificationCampaign $campaign, int $revision, string $idempotencyKey, array $context): NotificationCampaign
    {
        return DB::transaction(function () use ($admin, $campaign, $revision, $idempotencyKey, $context): NotificationCampaign {
            $locked = NotificationCampaign::whereKey($campaign->id)->lockForUpdate()->firstOrFail();
            $keyHash = hash('sha256', $idempotencyKey);
            if ($locked->status !== NotificationCampaignStatus::Draft) {
                if ($locked->send_idempotency_hash === $keyHash && $locked->send_revision === $revision) {
                    return $locked;
                }
                throw new ConflictHttpException('This campaign was already sent or changed. Refresh its status.');
            }

            $this->assertDraftRevision($locked, $revision);
            if ($locked->previewed_at === null || $locked->preview_revision !== $revision
                || $locked->previewed_at->lt(now()->subMinutes(10))) {
                throw new ConflictHttpException('Preview this revision again before sending.');
            }
            $this->assertDestinationVisible($locked);
            $cutoff = now();
            $customerIds = $this->eligibleCustomers($cutoff)
                ->select('users.id')->orderBy('users.id')->limit(self::MAX_RECIPIENTS + 1)
                ->pluck('users.id');
            $count = $customerIds->count();
            abort_if($count === 0, 422, 'There are no opted-in active Customers to notify.');
            abort_if($count > self::MAX_RECIPIENTS, 422, 'The eligible audience exceeds 10,000 Customers.');

            $locked->update(['status' => NotificationCampaignStatus::Preparing]);
            $batch = [];
            foreach ($customerIds as $customerId) {
                $batch[] = [
                    'id' => (string) Str::uuid7(),
                    'campaign_id' => $locked->id,
                    'user_id' => $customerId,
                    'notification_id' => Uuid::uuid5(Uuid::NAMESPACE_URL, "aisley:customer:{$customerId}:campaign:{$locked->id}")->toString(),
                    'status' => NotificationCampaignRecipientStatus::Pending->value,
                    'attempt_count' => 0,
                    'created_at' => $cutoff,
                    'updated_at' => $cutoff,
                ];
                if (count($batch) === 200) {
                    DB::table('notification_campaign_recipients')->insert($batch);
                    $batch = [];
                }
            }
            if ($batch !== []) {
                DB::table('notification_campaign_recipients')->insert($batch);
            }

            $locked->update([
                'status' => NotificationCampaignStatus::Queued,
                'revision' => $revision + 1,
                'destination_slug' => $locked->destination_type === 'shop'
                    ? Shop::whereKey($locked->destination_id)->value('slug') : null,
                'send_idempotency_hash' => $keyHash,
                'send_revision' => $revision,
                'audience_cutoff_at' => $cutoff,
                'snapshot_count' => $count,
                'confirmed_at' => $cutoff,
            ]);
            $this->audit($admin, AdminAuditAction::NotificationCampaignSent, $locked, $context);
            DB::afterCommit(function () use ($locked): void {
                try {
                    ProcessNotificationCampaign::dispatch($locked->id);
                } catch (Throwable $exception) {
                    Log::warning('Campaign queue dispatch deferred', ['campaign_id' => $locked->id, 'category' => $exception::class]);
                }
            });

            return $locked;
        });
    }

    public function deliverRecipient(string $recipientId): void
    {
        DB::transaction(function () use ($recipientId): void {
            $recipient = NotificationCampaignRecipient::whereKey($recipientId)->lockForUpdate()->first();
            if (! $recipient || $recipient->status === NotificationCampaignRecipientStatus::Delivered
                || $recipient->status === NotificationCampaignRecipientStatus::Skipped || $recipient->attempt_count >= 3) {
                return;
            }
            $campaign = NotificationCampaign::find($recipient->campaign_id);
            if (! $campaign || ! in_array($campaign->status, [NotificationCampaignStatus::Queued, NotificationCampaignStatus::Sending, NotificationCampaignStatus::PartiallyFailed, NotificationCampaignStatus::Failed], true)) {
                return;
            }
            $customer = User::whereKey($recipient->user_id)->lockForUpdate()->first();
            $profile = $customer ? $customer->customerProfile()->lockForUpdate()->first() : null;
            if (! $customer || $customer->role !== UserRole::Customer || $customer->status !== UserStatus::Active
                || ! $profile?->promotional_in_app_opted_in) {
                $recipient->update(['status' => NotificationCampaignRecipientStatus::Skipped, 'last_error_category' => 'ineligible']);

                return;
            }

            DB::table('notifications')->insertOrIgnore([
                'id' => $recipient->notification_id,
                'type' => 'customer-campaign.promotion',
                'notifiable_type' => $customer->getMorphClass(),
                'notifiable_id' => $customer->id,
                'data' => json_encode([
                    'campaign_id' => $campaign->id,
                    'title' => $campaign->title,
                    'summary' => mb_substr($campaign->body, 0, 500),
                    'destination_type' => $campaign->destination_type,
                    'destination_id' => $campaign->destination_id,
                    'destination_slug' => $campaign->destination_slug,
                ], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $persisted = DB::table('notifications')
                ->where('id', $recipient->notification_id)
                ->where('type', 'customer-campaign.promotion')
                ->where('notifiable_type', $customer->getMorphClass())
                ->where('notifiable_id', $customer->id)
                ->exists();
            if (! $persisted) {
                throw new \RuntimeException('Campaign notification identity collision.');
            }
            $recipient->update([
                'status' => NotificationCampaignRecipientStatus::Delivered,
                'attempt_count' => $recipient->attempt_count + 1,
                'last_error_category' => null,
            ]);
        });
    }

    public function markFailed(string $recipientId): void
    {
        DB::transaction(function () use ($recipientId): void {
            $recipient = NotificationCampaignRecipient::whereKey($recipientId)->lockForUpdate()->first();
            if ($recipient && ! in_array($recipient->status, [NotificationCampaignRecipientStatus::Delivered, NotificationCampaignRecipientStatus::Skipped], true)) {
                $recipient->update([
                    'status' => NotificationCampaignRecipientStatus::Failed,
                    'attempt_count' => min(3, $recipient->attempt_count + 1),
                    'last_error_category' => 'delivery_error',
                ]);
            }
        });
    }

    public function reconcile(string $campaignId): void
    {
        DB::transaction(function () use ($campaignId): void {
            $campaign = NotificationCampaign::whereKey($campaignId)->lockForUpdate()->first();
            if (! $campaign || $campaign->status === NotificationCampaignStatus::Draft || $campaign->status === NotificationCampaignStatus::Preparing) {
                return;
            }
            if ($campaign->completed_at?->lte(now()->subDays(90)) && ! $campaign->recipients()->exists()) {
                return;
            }
            $counts = $campaign->recipients()->select('status')->selectRaw('COUNT(*) AS total')->groupBy('status')->pluck('total', 'status');
            $pending = (int) ($counts[NotificationCampaignRecipientStatus::Pending->value] ?? 0);
            $delivered = (int) ($counts[NotificationCampaignRecipientStatus::Delivered->value] ?? 0);
            $skipped = (int) ($counts[NotificationCampaignRecipientStatus::Skipped->value] ?? 0);
            $failed = (int) ($counts[NotificationCampaignRecipientStatus::Failed->value] ?? 0);
            $status = $pending > 0 ? NotificationCampaignStatus::Sending
                : ($failed === 0 ? NotificationCampaignStatus::Completed
                    : ($delivered > 0 ? NotificationCampaignStatus::PartiallyFailed : NotificationCampaignStatus::Failed));
            $campaign->update([
                'delivered_count' => $delivered,
                'skipped_count' => $skipped,
                'failed_count' => $failed,
                'status' => $status,
                'completed_at' => $pending === 0
                    ? ($campaign->status === $status ? ($campaign->completed_at ?? now()) : now())
                    : null,
            ]);
        });
    }

    private function eligibleCustomers($cutoff): Builder
    {
        return DB::table('users')->join('customer_profiles', 'customer_profiles.user_id', '=', 'users.id')
            ->where('users.role', UserRole::Customer->value)
            ->where('users.status', UserStatus::Active->value)
            ->where('customer_profiles.promotional_in_app_opted_in', true)
            ->where('users.created_at', '<=', $cutoff);
    }

    /** @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function content(array $data): array
    {
        return [
            'title' => trim($data['title']),
            'body' => trim($data['body']),
            'audience_key' => $data['audience_key'],
            'destination_type' => $data['destination_type'] ?? null,
            'destination_id' => $data['destination_id'] ?? null,
        ];
    }

    private function assertDraftRevision(NotificationCampaign $campaign, int $revision): void
    {
        if ($campaign->status !== NotificationCampaignStatus::Draft || $campaign->revision !== $revision) {
            throw new ConflictHttpException('The campaign changed. Refresh before continuing.');
        }
    }

    private function assertDestinationVisible(NotificationCampaign $campaign): void
    {
        if ($campaign->destination_type === null) {
            return;
        }
        $visible = match ($campaign->destination_type) {
            'product' => Product::storefrontVisible()->whereKey($campaign->destination_id)->exists(),
            'shop' => Shop::storefrontVisible()->whereKey($campaign->destination_id)->exists(),
            default => false,
        };
        abort_unless($visible, 422, 'The selected destination is not visible to Customers.');
    }

    private function audit(User $admin, AdminAuditAction $action, NotificationCampaign $campaign, array $context): void
    {
        $this->audit->record(
            actor: $admin,
            action: $action,
            sourceFeature: AuditSourceFeature::NotificationCampaigns,
            target: $campaign,
            targetSnapshot: ['id' => $campaign->id],
            metadata: ['audience_key' => $campaign->audience_key, 'revision' => $campaign->revision],
            ipAddress: $context['ip_address'] ?? null,
            userAgent: $context['user_agent'] ?? null,
            requestId: $context['request_id'] ?? null,
        );
    }
}
