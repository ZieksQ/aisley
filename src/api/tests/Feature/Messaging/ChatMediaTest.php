<?php

namespace Tests\Feature\Messaging;

use App\Enums\ChatAttachmentState;
use App\Enums\FirstMileTaskStatus;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\ProcessChatAttachment;
use App\Models\ChatAttachment;
use App\Models\Conversation;
use App\Models\DeliveryTask;
use App\Models\FirstMileTask;
use App\Models\PickupSchedule;
use App\Models\SellerPickupRequest;
use App\Models\User;
use App\Services\Messaging\Media\ChatAttachmentProcessor;
use App\Services\Messaging\Media\ChatMediaScanner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Support\CreatesOperationalMessagingContext;
use Tests\TestCase;

class ChatMediaTest extends TestCase
{
    use CreatesOperationalMessagingContext;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['chat_media.enabled' => true, 'chat_media.disk' => 'local']);
        Storage::fake('local');
        Queue::fake([ProcessChatAttachment::class]);
        $this->mock(ChatMediaScanner::class, function ($mock): void {
            $mock->shouldReceive('available')->andReturn(true);
            $mock->shouldReceive('scan')->andReturn(true);
        });
    }

    public function test_private_first_message_image_and_caption_retry_and_cross_role_history(): void
    {
        [, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $buyer = $order->customer;
        $asset = $this->upload($buyer, ['channel' => 'shop', 'shop_id' => $order->shop_id]);
        $this->assertDatabaseCount('conversations', 0);
        $this->actingAs($buyer)->getJson("/api/v1/customer/chat-attachments/{$asset}/content")->assertNotFound();
        $this->postJson('/api/v1/customer/conversations', ['shop_id' => $order->shop_id, 'attachment_ids' => [$asset]], $this->key())->assertUnprocessable();
        app(ChatAttachmentProcessor::class)->process($asset);
        $this->assertSame(ChatAttachmentState::Ready, ChatAttachment::findOrFail($asset)->state);
        $key = $this->key();
        $input = ['shop_id' => $order->shop_id, 'attachment_ids' => [$asset]];
        $first = $this->postJson('/api/v1/customer/conversations', $input, $key)->assertCreated()
            ->assertJsonPath('message.body', 'Sent an attachment')->assertJsonPath('message.attachments.0.id', $asset);
        $this->postJson('/api/v1/customer/conversations', $input, $key)->assertCreated()
            ->assertJsonPath('message.id', $first->json('message.id'));
        $this->postJson('/api/v1/customer/conversations', $input + ['body' => 'Changed'], $key)->assertConflict();
        $conversation = $first->json('conversation.id');
        $this->actingAs($order->shop->seller)->getJson("/api/v1/seller/conversations/{$conversation}/messages")
            ->assertOk()->assertJsonPath('items.0.attachments.0.content_url', "/api/v1/seller/chat-attachments/{$asset}/content")
            ->assertJsonMissingPath('items.0.attachments.0.path');
        $this->get("/api/v1/seller/chat-attachments/{$asset}/preview")->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->get("/api/v1/seller/chat-attachments/{$asset}/content")->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $reply = $this->upload($order->shop->seller, ['conversation_id' => $conversation], UploadedFile::fake()->createWithContent('instructions.txt', 'Please keep the packaging.'));
        app(ChatAttachmentProcessor::class)->process($reply);
        $this->postJson("/api/v1/seller/conversations/{$conversation}/messages", ['body' => ' Instructions ', 'attachment_ids' => [$reply]], $this->key())
            ->assertCreated()->assertJsonPath('message.body', 'Instructions');
        $this->get("/api/v1/seller/chat-attachments/{$reply}/content")->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->actingAs($buyer)->deleteJson("/api/v1/customer/chat-attachments/{$asset}")->assertConflict();
        $foreign = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($foreign)->getJson("/api/v1/customer/chat-attachments/{$asset}/content")->assertNotFound();
        $this->actingAs(User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]))
            ->getJson("/api/v1/customer/chat-attachments/{$asset}/content")->assertForbidden();
    }

    public function test_operational_media_covers_every_existing_relationship_and_remains_scoped(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $shipment = $task->shipment;
        $organization = $logistics->logisticsOrganization;
        $shipment->update(['current_logistics_organization_id' => $organization->id, 'current_hub_id' => $organization->hub->id]);
        $order->update(['status' => OrderStatus::OutForDelivery]);
        $task->update(['status' => FulfillmentTaskStatus::OutForDelivery]);
        $task->offers()->update(['status' => 'accepted']);
        // Resolve via the explicit immutable reference used by the conversation service.
        $pickupId = $order->waybill->seller_pickup_request_id;
        $pickup = SellerPickupRequest::findOrFail($pickupId);
        $schedule = PickupSchedule::create(['courier_id' => $courier->id, 'reference' => 'PICK-'.Str::random(8),
            'starts_at' => now()->addHour(), 'ends_at' => now()->addHours(2), 'idempotency_key' => (string) Str::uuid(),
            'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $organization->hub->id,
            'scheduled_pickup_at' => now()->addHour(), 'status' => 'scheduled', 'created_by' => $logistics->id]);
        $event = $order->statusEvents()->create(['from_status' => OrderStatus::Placed,
            'to_status' => OrderStatus::ReadyForPickup, 'source' => 'seller_pickup', 'occurred_at' => now()]);
        $pickup->orders()->create(['order_id' => $order->id, 'status_event_id' => $event->id, 'position' => 0]);

        $pairs = [
            [$order->customer, 'customer', ['channel' => 'logistics', 'context_type' => 'order', 'context_id' => $order->id], 'logistics-conversations', ['context_type' => 'order', 'context_id' => $order->id], $logistics, 'logistics'],
            [$order->shop->seller, 'seller', ['channel' => 'logistics', 'context_type' => 'pickup_request', 'context_id' => $pickupId], 'logistics-conversations', ['context_type' => 'pickup_request', 'context_id' => $pickupId], $logistics, 'logistics'],
            [$logistics, 'logistics', ['channel' => 'operational', 'leg' => 'final_mile', 'task_id' => $task->id], 'operational-conversations', ['leg' => 'final_mile', 'task_id' => $task->id], $courier, 'courier'],
            [$order->customer, 'customer', ['channel' => 'courier', 'context_type' => 'order', 'context_id' => $order->id], 'courier-conversations', ['context_type' => 'order', 'context_id' => $order->id], $courier, 'courier'],
        ];
        foreach ($pairs as [$sender, $role, $context, $route, $start, $recipient, $recipientRole]) {
            $asset = $this->upload($sender, $context);
            app(ChatAttachmentProcessor::class)->process($asset);
            $first = $this->actingAs($sender)->postJson("/api/v1/{$role}/{$route}", $start + ['attachment_ids' => [$asset]], $this->key())
                ->assertCreated()->assertJsonPath('message.attachments.0.id', $asset);
            $this->actingAs($recipient)->get("/api/v1/{$recipientRole}/chat-attachments/{$asset}/content")->assertOk();
            if ($recipientRole !== 'courier') {
                $this->getJson("/api/v1/{$recipientRole}/chat-notifications")->assertOk()
                    ->assertJsonPath('data.0.id', $first->json('conversation.id'));
            }
            $reply = $this->upload($recipient, ['conversation_id' => $first->json('conversation.id')]);
            app(ChatAttachmentProcessor::class)->process($reply);
            $recipientRoute = in_array($recipientRole, ['courier', 'logistics'], true) ? 'operational-conversations' : $route;
            $this->actingAs($recipient)->postJson("/api/v1/{$recipientRole}/{$recipientRoute}/{$first->json('conversation.id')}/messages", ['attachment_ids' => [$reply]], $this->key())
                ->assertCreated()->assertJsonPath('message.attachments.0.id', $reply);
        }

        $order->update(['status' => OrderStatus::ReadyForPickup]);
        $legacy = FirstMileTask::create(['pickup_schedule_id' => $schedule->id,
            'order_id' => $order->id, 'waybill_id' => $order->waybill->id,
            'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $organization->hub->id,
            'courier_id' => $courier->id, 'status' => FirstMileTaskStatus::Accepted]);
        $firstMile = DeliveryTask::create(['shipment_id' => $shipment->id, 'leg' => 'first_mile',
            'status' => FulfillmentTaskStatus::SellerPickupAccepted, 'courier_id' => $courier->id, 'legacy_first_mile_task_id' => $legacy->id]);
        $context = ['channel' => 'operational', 'leg' => 'first_mile', 'task_id' => $firstMile->id, 'counterparty_role' => 'seller'];
        $asset = $this->upload($courier, $context);
        app(ChatAttachmentProcessor::class)->process($asset);
        $first = $this->actingAs($courier)->postJson('/api/v1/courier/operational-conversations', array_diff_key($context, ['channel' => true]) + ['attachment_ids' => [$asset]], $this->key())->assertCreated();
        $this->actingAs($order->shop->seller)->get("/api/v1/seller/chat-attachments/{$asset}/content")->assertOk();
        $reply = $this->upload($order->shop->seller, ['conversation_id' => $first->json('conversation.id')]);
        app(ChatAttachmentProcessor::class)->process($reply);
        $this->postJson("/api/v1/seller/courier-conversations/{$first->json('conversation.id')}/messages", ['attachment_ids' => [$reply]], $this->key())->assertCreated();
        $legacy->update(['status' => FirstMileTaskStatus::PickedUp]);
        $this->get("/api/v1/seller/chat-attachments/{$asset}/content")->assertOk();
        $this->post('/api/v1/seller/chat-attachments', ['context' => json_encode(['conversation_id' => $first->json('conversation.id')]), 'file' => UploadedFile::fake()->image('late.png')], $this->key())->assertConflict();
    }

    public function test_upload_replay_content_spoofing_scanner_failures_and_cleanup(): void
    {
        [, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $context = ['channel' => 'shop', 'shop_id' => $order->shop_id];
        $file = UploadedFile::fake()->createWithContent('note.txt', 'Packaging instructions');
        $key = $this->key();
        $asset = $this->upload($order->customer, $context, $file, $key);
        $this->upload($order->customer, $context, $file, $key, 200);
        $this->assertDatabaseCount('chat_attachments', 1);
        $this->post('/api/v1/customer/chat-attachments', ['file' => UploadedFile::fake()->createWithContent('note.txt', 'Changed'), 'context' => json_encode($context)], $key)->assertConflict();
        $this->post('/api/v1/customer/chat-attachments', ['file' => UploadedFile::fake()->create('bad.svg', 1), 'context' => json_encode($context)], $this->key())->assertUnprocessable();
        $spoof = $this->upload($order->customer, $context, UploadedFile::fake()->createWithContent('photo.jpg', 'not an image'));
        app(ChatAttachmentProcessor::class)->process($spoof);
        $this->assertSame(ChatAttachmentState::Rejected, ChatAttachment::findOrFail($spoof)->state);
        $this->mock(ChatMediaScanner::class, function ($mock): void {
            $mock->shouldReceive('available')->andReturn(true);
            $mock->shouldReceive('scan')->andThrow(new \RuntimeException('unavailable'));
        });
        for ($i = 0; $i < 3; $i++) {
            try {
                app(ChatAttachmentProcessor::class)->process($asset);
            } catch (\RuntimeException) {
            }
        }
        $this->assertSame(ChatAttachmentState::Failed, ChatAttachment::findOrFail($asset)->state);
        $this->postJson("/api/v1/customer/chat-attachments/{$asset}/retry")->assertOk()->assertJsonPath('data.state', 'pending');
        $this->mock(ChatMediaScanner::class, function ($mock): void {
            $mock->shouldReceive('available')->andReturn(true);
            $mock->shouldReceive('scan')->andReturn(false);
        });
        app(ChatAttachmentProcessor::class)->process($asset);
        $this->assertSame(ChatAttachmentState::Rejected, ChatAttachment::findOrFail($asset)->state);
        ChatAttachment::whereIn('id', [$asset, $spoof])->update(['expires_at' => now()->subMinute()]);
        $this->artisan('chat:maintain-media')->assertSuccessful();
        $this->assertSame(ChatAttachmentState::Deleted, ChatAttachment::findOrFail($asset)->state);
        Storage::disk('local')->assertMissing(ChatAttachment::findOrFail($asset)->path);
        config(['chat_media.enabled' => false]);
        Cache::flush();
        $this->getJson('/api/v1/customer/chat-attachments')->assertOk()->assertJsonPath('data.enabled', false);
        $this->post('/api/v1/customer/chat-attachments', ['file' => $file, 'context' => json_encode($context)], $this->key())->assertStatus(503);
        $this->postJson('/api/v1/customer/conversations', ['shop_id' => $order->shop_id, 'body' => 'Text still works'], $this->key())->assertCreated();
    }

    public function test_wrong_context_pending_reuse_and_attachment_order_are_rejected_atomically(): void
    {
        [, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $context = ['channel' => 'shop', 'shop_id' => $order->shop_id];
        $ids = [$this->upload($order->customer, $context), $this->upload($order->customer, $context)];
        foreach ($ids as $id) {
            app(ChatAttachmentProcessor::class)->process($id);
        }
        ChatAttachment::whereKey($ids[1])->update(['scope_hash' => str_repeat('0', 64)]);
        $this->postJson('/api/v1/customer/conversations', ['shop_id' => $order->shop_id, 'attachment_ids' => $ids], $this->key())->assertUnprocessable();
        $this->assertDatabaseCount('messages', 0);
        $this->assertNull(ChatAttachment::findOrFail($ids[0])->message_id);
        ChatAttachment::whereKey($ids[1])->update(['scope_hash' => ChatAttachment::findOrFail($ids[0])->scope_hash]);
        $key = $this->key();
        $first = $this->postJson('/api/v1/customer/conversations', ['shop_id' => $order->shop_id, 'attachment_ids' => $ids], $key)->assertCreated();
        $this->postJson('/api/v1/customer/conversations', ['shop_id' => $order->shop_id, 'attachment_ids' => array_reverse($ids)], $key)->assertConflict();
        $this->postJson("/api/v1/customer/conversations/{$first->json('conversation.id')}/messages", ['attachment_ids' => $ids], $this->key())->assertUnprocessable();
        $this->assertDatabaseCount('messages', 1);
    }

    public function test_message_count_size_expiry_and_missing_file_limits_roll_back(): void
    {
        [, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $context = ['channel' => 'shop', 'shop_id' => $order->shop_id];
        $ids = [];
        for ($index = 0; $index < 6; $index++) {
            $id = $this->upload($order->customer, $context);
            app(ChatAttachmentProcessor::class)->process($id);
            $ids[] = $id;
        }
        $input = ['shop_id' => $order->shop_id, 'attachment_ids' => $ids];
        $this->postJson('/api/v1/customer/conversations', $input, $this->key())->assertUnprocessable();
        $input['attachment_ids'] = ['named' => $ids[0]];
        $this->postJson('/api/v1/customer/conversations', $input, $this->key())->assertUnprocessable();
        $input['attachment_ids'] = [$ids[0], $ids[0]];
        $this->postJson('/api/v1/customer/conversations', $input, $this->key())->assertUnprocessable();
        $input['attachment_ids'] = [$ids[0], $ids[1]];
        // Exercise authoritative combined-byte validation independently of inspection.
        ChatAttachment::whereIn('id', $input['attachment_ids'])->update(['byte_size' => 30 * 1024 * 1024]);
        $this->postJson('/api/v1/customer/conversations', $input, $this->key())->assertUnprocessable();
        $this->assertDatabaseCount('messages', 0);
        $this->assertNull(ChatAttachment::findOrFail($ids[0])->message_id);
        ChatAttachment::whereIn('id', $ids)->update(['byte_size' => 100]);
        ChatAttachment::whereKey($ids[0])->update(['expires_at' => now()->subSecond()]);
        $this->postJson('/api/v1/customer/conversations', $input, $this->key())->assertUnprocessable();
        ChatAttachment::whereKey($ids[0])->update(['expires_at' => now()->addHour()]);
        Storage::disk('local')->delete(ChatAttachment::findOrFail($ids[1])->path);
        $this->postJson('/api/v1/customer/conversations', $input, $this->key())->assertUnprocessable();
        $this->assertDatabaseCount('conversations', 0);
        $this->actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Suspended]))
            ->getJson('/api/v1/customer/chat-attachments')->assertForbidden();
    }

    public function test_private_video_delivery_supports_bounded_single_ranges(): void
    {
        [, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $bytes = str_repeat('0123456789', 100);
        $id = $this->upload($order->customer, ['channel' => 'shop', 'shop_id' => $order->shop_id],
            UploadedFile::fake()->createWithContent('clip.mp4', $bytes));
        // Processor codec/content validation is exercised with real FFmpeg in the unit suite.
        ChatAttachment::whereKey($id)->update(['state' => ChatAttachmentState::Ready]);
        $this->postJson('/api/v1/customer/conversations', ['shop_id' => $order->shop_id, 'attachment_ids' => [$id]], $this->key())->assertCreated();
        $this->actingAs($order->shop->seller);
        $url = "/api/v1/seller/chat-attachments/{$id}/content";
        $range = $this->get($url, ['Range' => 'bytes=12-21'])->assertStatus(206)
            ->assertHeader('Content-Range', 'bytes 12-21/1000')->assertHeader('Content-Length', '10')
            ->assertHeader('Accept-Ranges', 'bytes')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertSame(substr($bytes, 12, 10), $range->streamedContent());
        $this->assertSame(substr($bytes, -5), $this->get($url, ['Range' => 'bytes=-5'])->assertStatus(206)->streamedContent());
        $this->assertSame(substr($bytes, 990), $this->get($url, ['Range' => 'bytes=990-'])->assertStatus(206)->streamedContent());
        foreach (['bytes=1000-', 'bytes=12-3', 'bytes=-0', 'bytes=0-1,4-5', 'bytes=-'] as $range) {
            $this->get($url, ['Range' => $range])->assertStatus(416)->assertHeader('Content-Range', 'bytes */1000');
        }
        config(['chat_media.enabled' => false]);
        $this->get($url)->assertOk();
    }

    public function test_worker_failure_recovery_and_private_scratch_cleanup(): void
    {
        [, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $id = $this->upload($order->customer, ['channel' => 'shop', 'shop_id' => $order->shop_id]);
        (new ProcessChatAttachment($id))->failed(new \RuntimeException('Worker timed out'));
        $this->assertSame(ChatAttachmentState::Failed, ChatAttachment::findOrFail($id)->state);
        $this->assertTrue((new ProcessChatAttachment($id))->failOnTimeout);
        $this->postJson("/api/v1/customer/chat-attachments/{$id}/retry")->assertOk();
        ChatAttachment::whereKey($id)->update(['updated_at' => now()->subMinutes(11)]);
        $this->artisan('chat:maintain-media')->assertSuccessful();
        Queue::assertPushed(ProcessChatAttachment::class, 3);
        app(ChatAttachmentProcessor::class)->process($id);
        // A stale failed-job callback cannot downgrade a completed asset.
        (new ProcessChatAttachment($id))->failed(new \RuntimeException('Stale failure'));
        $this->assertSame(ChatAttachmentState::Ready, ChatAttachment::findOrFail($id)->state);
        $directory = storage_path('app/private/chat-processing');
        $old = tempnam($directory, 'media-');
        $recent = tempnam($directory, 'media-');
        touch($old, now()->subDays(2)->getTimestamp());
        try {
            $this->artisan('chat:maintain-media')->assertSuccessful();
            $this->assertFileDoesNotExist($old);
            $this->assertFileExists($recent);
        } finally {
            @unlink($old);
            @unlink($recent);
        }
    }

    public function test_per_file_size_boundaries_and_unknown_types_are_rejected_before_processing(): void
    {
        [, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $context = ['channel' => 'shop', 'shop_id' => $order->shop_id];
        foreach ([['edge.jpg', 10240, 'image/jpeg'], ['large.txt', 10241, 'text/plain'],
            ['large.mp4', 30721, 'video/mp4'], ['photo.backup.jpg', 10, 'image/jpeg'],
            ['macro.docm', 10, 'application/octet-stream'], ['recording.mp3', 10, 'audio/mpeg']] as [$name, $size, $mime]) {
            $this->actingAs($order->customer)->post('/api/v1/customer/chat-attachments', [
                'context' => json_encode($context), 'file' => UploadedFile::fake()->create($name, $size, $mime),
            ], $this->key())->assertUnprocessable();
        }
        $this->assertDatabaseCount('chat_attachments', 0);
        $id = $this->upload($order->customer, $context, UploadedFile::fake()->createWithContent('notes.txt', substr(str_repeat("Please handle delivery carefully.\n", 320000), 0, 10 * 1024 * 1024)));
        app(ChatAttachmentProcessor::class)->process($id);
        $this->assertSame(ChatAttachmentState::Ready, ChatAttachment::findOrFail($id)->state);
        $this->assertSame(10 * 1024 * 1024, ChatAttachment::findOrFail($id)->byte_size);
        $this->actingAs($order->shop->seller)->getJson("/api/v1/seller/chat-attachments/{$id}")->assertNotFound();
        config(['chat_media.disk' => 'public']);
        $this->getJson('/api/v1/seller/chat-attachments')->assertOk()->assertJsonPath('data.enabled', false);
    }

    public function test_customer_courier_upload_browsing_and_history_do_not_consume_message_budgets(): void
    {
        [$logistics, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $organization = $logistics->logisticsOrganization;
        $task->shipment->update(['current_logistics_organization_id' => $organization->id, 'current_hub_id' => $organization->hub->id]);
        $order->update(['status' => OrderStatus::OutForDelivery]);
        $task->update(['status' => FulfillmentTaskStatus::OutForDelivery]);
        $task->offers()->update(['status' => 'accepted']);
        $this->actingAs($order->customer);
        for ($index = 0; $index < 20; $index++) {
            $this->getJson('/api/v1/customer/shops')->assertOk();
        }
        $id = $this->upload($order->customer, ['channel' => 'courier', 'context_type' => 'order', 'context_id' => $order->id]);
        app(ChatAttachmentProcessor::class)->process($id);
        $base = '/api/v1/customer/courier-conversations';
        $input = ['context_type' => 'order', 'context_id' => $order->id];
        $first = $this->postJson($base, $input + ['attachment_ids' => [$id]], $this->key())->assertCreated();
        $conversation = $first->json('conversation.id');
        for ($index = 1; $index < 15; $index++) {
            $this->postJson($base, $input + ['body' => 'Start'], $this->key())->assertCreated();
        }
        $this->postJson($base, $input + ['body' => 'Start'], $this->key())->assertStatus(429)->assertHeader('X-RateLimit-Limit', '15');
        for ($index = 0; $index < 10; $index++) {
            $this->getJson("{$base}/{$conversation}/messages")->assertOk();
        }
        for ($index = 0; $index < 30; $index++) {
            $this->postJson("{$base}/{$conversation}/messages", ['body' => 'Reply'], $this->key())->assertCreated();
        }
        $this->postJson("{$base}/{$conversation}/messages", ['body' => 'Reply'], $this->key())->assertStatus(429)->assertHeader('X-RateLimit-Limit', '30');
    }

    private function upload(User $user, array $context, ?UploadedFile $file = null, ?array $key = null, int $status = 201): string
    {
        $response = $this->actingAs($user)->post('/api/v1/'.$user->role->value.'/chat-attachments', [
            'context' => json_encode($context), 'file' => $file ?? UploadedFile::fake()->image('photo.png', 20, 10),
        ], ($key ?? $this->key()) + ['Accept' => 'application/json'])->assertStatus($status);

        return $response->json('data.id');
    }

    private function key(): array
    {
        return ['Idempotency-Key' => (string) Str::uuid(), 'Accept' => 'application/json'];
    }
}
