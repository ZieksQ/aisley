<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\Admin\ProcessNotificationCampaign;
use App\Models\CustomerProfile;
use App\Models\NotificationCampaign;
use App\Models\NotificationCampaignRecipient;
use App\Models\Permission;
use App\Models\User;
use App\Services\Admin\NotificationCampaignService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class NotificationCampaignTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    public function test_permissions_and_customer_preference_default_off(): void
    {
        $this->getJson('/api/v1/admin/notification-campaigns')->assertUnauthorized();
        $customer = $this->customer();
        $this->actingAs($customer)->getJson('/api/v1/admin/notification-campaigns')->assertForbidden();
        $this->getJson('/api/v1/customer/account/notification-preferences')
            ->assertOk()->assertJsonPath('data.promotional_in_app_opted_in', false);

        $admin = $this->admin();
        $this->actingAs($admin)->getJson('/api/v1/admin/notification-campaigns')->assertForbidden();
        $this->grant($admin, 'notification-campaigns.view');
        $this->getJson('/api/v1/admin/notification-campaigns')->assertOk();
        $this->postJson('/api/v1/admin/notification-campaigns', $this->payload())->assertForbidden();
        $this->grant($admin, 'notification-campaigns.manage');
        $this->postJson('/api/v1/admin/notification-campaigns', $this->payload())->assertCreated();
        $this->postJson('/api/v1/admin/notification-campaigns', [...$this->payload(), 'body' => '<script>alert(1)</script>'])
            ->assertUnprocessable()->assertJsonValidationErrors('body');

        $this->actingAs($customer)->patchJson('/api/v1/customer/account/notification-preferences', [
            'promotional_in_app_opted_in' => true,
        ])->assertOk()->assertJsonPath('data.promotional_in_app_opted_in', true);
        $this->assertDatabaseHas('customer_profiles', ['user_id' => $customer->id, 'promotional_in_app_opted_in' => true]);
        $this->patchJson('/api/v1/customer/account/notification-preferences', [
            'promotional_in_app_opted_in' => false,
        ])->assertOk()->assertJsonPath('data.promotional_in_app_opted_in_at', null);
    }

    public function test_send_freezes_opted_in_audience_and_retries_without_duplicate_notifications(): void
    {
        Queue::fake();
        $admin = $this->admin();
        $this->grant($admin, 'notification-campaigns.manage');
        $this->grant($admin, 'notification-campaigns.view');
        $first = $this->customer(true);
        $second = $this->customer(true);
        $excluded = $this->customer();
        $campaign = $this->actingAs($admin)->postJson('/api/v1/admin/notification-campaigns', $this->payload())
            ->assertCreated()->assertJsonPath('data.status', 'draft');
        $id = $campaign->json('data.id');
        $this->postJson("/api/v1/admin/notification-campaigns/{$id}/send", ['revision' => 1, 'confirmation' => true], [
            'Idempotency-Key' => 'campaign-key-123',
        ])->assertConflict();
        $this->postJson("/api/v1/admin/notification-campaigns/{$id}/preview", ['revision' => 1])
            ->assertOk()->assertJsonPath('data.eligible_count', 2);
        $sent = $this->postJson("/api/v1/admin/notification-campaigns/{$id}/send", ['revision' => 1, 'confirmation' => true], [
            'Idempotency-Key' => 'campaign-key-123',
        ])->assertOk()->assertJsonPath('data.snapshot_count', 2);
        $this->assertDatabaseCount('notification_campaign_recipients', 2);
        $this->assertDatabaseCount('notifications', 0);
        $this->postJson("/api/v1/admin/notification-campaigns/{$id}/send", ['revision' => 1, 'confirmation' => true], [
            'Idempotency-Key' => 'campaign-key-123',
        ])->assertOk()->assertJsonPath('data.id', $id);
        $this->postJson("/api/v1/admin/notification-campaigns/{$id}/send", ['revision' => 1, 'confirmation' => true], [
            'Idempotency-Key' => 'another-key-123',
        ])->assertConflict();

        $this->actingAs($second)->patchJson('/api/v1/customer/account/notification-preferences', [
            'promotional_in_app_opted_in' => false,
        ])->assertOk();
        app(ProcessNotificationCampaign::class, ['campaignId' => $id])->handle(app(NotificationCampaignService::class));
        app(ProcessNotificationCampaign::class, ['campaignId' => $id])->handle(app(NotificationCampaignService::class));
        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $first->id, 'type' => 'customer-campaign.promotion']);
        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $second->id, 'type' => 'customer-campaign.promotion']);
        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $excluded->id, 'type' => 'customer-campaign.promotion']);
        $this->actingAs($admin)->getJson("/api/v1/admin/notification-campaigns/{$id}")
            ->assertOk()->assertJsonPath('data.delivered_count', 1)->assertJsonPath('data.skipped_count', 1)
            ->assertJsonPath('data.status', 'completed');
        $this->assertStringNotContainsString($first->email, $this->getJson("/api/v1/admin/notification-campaigns/{$id}")->content());
        $this->actingAs($first)->getJson('/api/v1/customer/notifications')
            ->assertOk()->assertJsonPath('data.0.type', 'customer-campaign.promotion')
            ->assertJsonPath('data.0.summary', 'Browse the latest items this weekend.');
        $this->assertDatabaseHas('audit_outbox', ['action' => 'notification_campaign.sent']);
        $this->assertNotNull($sent->json('data.confirmed_at'));
    }

    public function test_empty_audience_stale_revision_and_90_day_recipient_retention(): void
    {
        Queue::fake();
        $admin = $this->admin();
        $this->grant($admin, 'notification-campaigns.manage');
        $this->grant($admin, 'notification-campaigns.view');
        $customer = $this->customer();
        $created = $this->actingAs($admin)->postJson('/api/v1/admin/notification-campaigns', $this->payload())->assertCreated();
        $id = $created->json('data.id');
        $this->postJson("/api/v1/admin/notification-campaigns/{$id}/preview", ['revision' => 1])
            ->assertJsonPath('data.eligible_count', 0)->assertJsonPath('data.dispatch_allowed', false);
        $this->postJson("/api/v1/admin/notification-campaigns/{$id}/send", ['revision' => 1, 'confirmation' => true], [
            'Idempotency-Key' => 'campaign-key-123',
        ])->assertUnprocessable();
        $this->actingAs($customer)->patchJson('/api/v1/customer/account/notification-preferences', [
            'promotional_in_app_opted_in' => true,
        ])->assertOk();
        $this->actingAs($admin)->patchJson("/api/v1/admin/notification-campaigns/{$id}", [...$this->payload(), 'revision' => 1])
            ->assertOk()->assertJsonPath('data.revision', 2);
        $this->postJson("/api/v1/admin/notification-campaigns/{$id}/preview", ['revision' => 1])->assertConflict();
        $this->postJson("/api/v1/admin/notification-campaigns/{$id}/preview", ['revision' => 2])->assertOk();
        $this->actingAs($customer)->patchJson('/api/v1/customer/account/notification-preferences', [
            'promotional_in_app_opted_in' => false,
        ])->assertOk();
        $this->actingAs($admin)->postJson("/api/v1/admin/notification-campaigns/{$id}/send", ['revision' => 2, 'confirmation' => true], [
            'Idempotency-Key' => 'campaign-key-456',
        ])->assertUnprocessable();
        $this->actingAs($customer)->patchJson('/api/v1/customer/account/notification-preferences', [
            'promotional_in_app_opted_in' => true,
        ])->assertOk();
        $this->actingAs($admin)->postJson("/api/v1/admin/notification-campaigns/{$id}/preview", ['revision' => 2])->assertOk();
        $this->postJson("/api/v1/admin/notification-campaigns/{$id}/send", ['revision' => 2, 'confirmation' => true], [
            'Idempotency-Key' => 'campaign-key-456',
        ])->assertOk();
        app(ProcessNotificationCampaign::class, ['campaignId' => $id])->handle(app(NotificationCampaignService::class));
        NotificationCampaign::whereKey($id)->update(['completed_at' => now()->subDays(91)]);
        $this->artisan('campaigns:prune-recipients')->assertSuccessful();
        $this->assertDatabaseCount('notification_campaign_recipients', 0);
        $this->assertDatabaseHas('notification_campaigns', ['id' => $id, 'delivered_count' => 1, 'snapshot_count' => 1]);
    }

    public function test_failed_recipient_can_retry_without_resetting_campaign_history(): void
    {
        Queue::fake();
        $admin = $this->admin();
        $this->grant($admin, 'notification-campaigns.manage');
        $this->grant($admin, 'notification-campaigns.view');
        $customer = $this->customer(true);
        $id = $this->actingAs($admin)->postJson('/api/v1/admin/notification-campaigns', $this->payload())
            ->assertCreated()->json('data.id');
        $this->postJson("/api/v1/admin/notification-campaigns/{$id}/preview", ['revision' => 1])->assertOk();
        $this->postJson("/api/v1/admin/notification-campaigns/{$id}/send", ['revision' => 1, 'confirmation' => true], [
            'Idempotency-Key' => 'retry-key-123',
        ])->assertOk();
        $recipient = NotificationCampaignRecipient::where('campaign_id', $id)->firstOrFail();
        app(NotificationCampaignService::class)->markFailed($recipient->id);
        app(NotificationCampaignService::class)->reconcile($id);
        $this->assertDatabaseHas('notification_campaigns', ['id' => $id, 'status' => 'failed', 'failed_count' => 1]);
        DB::table('notification_campaign_recipients')->where('id', $recipient->id)
            ->update(['updated_at' => now()->subMinutes(6)]);

        app(ProcessNotificationCampaign::class, ['campaignId' => $id])->handle(app(NotificationCampaignService::class));
        $this->assertDatabaseHas('notification_campaigns', ['id' => $id, 'status' => 'completed', 'delivered_count' => 1, 'failed_count' => 0]);
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $customer->id, 'type' => 'customer-campaign.promotion']);
        $this->assertDatabaseCount('notifications', 1);
    }

    private function payload(): array
    {
        return ['title' => 'Weekend offer', 'body' => 'Browse the latest items this weekend.', 'audience_key' => 'opted_in_customers'];
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
    }

    private function customer(bool $optedIn = false): User
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        CustomerProfile::create([
            'user_id' => $customer->id, 'first_name' => 'Test', 'last_name' => 'Customer',
            'contact_number' => '09171234567', 'sex' => 'prefer_not_to_say', 'birth_date' => '2000-01-01',
            'promotional_in_app_opted_in' => $optedIn,
            'promotional_in_app_opted_in_at' => $optedIn ? now() : null,
        ]);

        return $customer;
    }

    private function grant(User $admin, string $slug): void
    {
        $permission = Permission::firstOrCreate(['slug' => $slug], ['name' => $slug, 'description' => $slug]);
        $admin->permissions()->syncWithoutDetaching([$permission->id]);
    }
}
