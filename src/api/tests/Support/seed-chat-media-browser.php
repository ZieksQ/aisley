<?php

use App\Enums\FirstMileTaskStatus;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\OrderStatus;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\DeliveryTask;
use App\Models\FirstMileTask;
use App\Models\PickupSchedule;
use App\Models\SellerPickupRequest;
use App\Services\Messaging\ConversationService;
use App\Services\Messaging\CourierCounterpartyConversationService;
use App\Services\Messaging\CustomerLogisticsConversationService;
use App\Services\Messaging\OperationalConversationService;
use App\Services\Messaging\SellerLogisticsConversationService;
use Dompdf\Dompdf;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\Support\CreatesOperationalMessagingContext;
use Tests\TestCase;

require dirname(__DIR__, 2).'/vendor/autoload.php';
foreach (simplexml_load_file('phpunit.xml')->php->env as $entry) {
    putenv((string) $entry['name'].'='.(string) $entry['value']);
}
$directory = dirname(__DIR__, 2).'/storage/framework/testing/chat-browser';
if (! is_dir($directory)) {
    mkdir($directory, 0700, true);
}
$file = $directory.'/fixture.sqlite';
touch($file);
foreach (['DB_CONNECTION' => 'sqlite', 'DB_URL' => '', 'DB_DATABASE' => $file,
    'SESSION_DRIVER' => 'file', 'QUEUE_CONNECTION' => 'database', 'CACHE_STORE' => 'file'] as $key => $value) {
    putenv($key.'='.$value);
    $_ENV[$key] = $value;
    $_SERVER[$key] = $value;
}

class ChatBrowserFixture extends TestCase
{
    use CreatesOperationalMessagingContext;

    public function prepare(string $directory): void
    {
        $this->setUp();
        if (config('database.default') !== 'sqlite' || ! str_ends_with(config('database.connections.sqlite.database'), '/chat-browser/fixture.sqlite')) {
            throw new RuntimeException('Only the isolated chat browser database may be reset.');
        }
        Artisan::call('migrate:fresh', ['--force' => true]);
        [$logistics, $courier, $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $organization = $logistics->logisticsOrganization;
        $task->shipment->update(['current_logistics_organization_id' => $organization->id, 'current_hub_id' => $organization->hub->id]);
        $order->update(['status' => OrderStatus::OutForDelivery]);
        $task->update(['status' => FulfillmentTaskStatus::OutForDelivery]);
        $task->offers()->update(['status' => 'accepted']);
        $buyer = $order->customer;
        $seller = $order->shop->seller;
        foreach ([$buyer, $seller, $logistics] as $user) {
            $user->update(['email' => 'chat-'.$user->role->value.'@example.test', 'password' => Hash::make('Chat-browser-password-123!')]);
            $relationship = match ($user->role->value) {
                'customer' => 'customerProfile', 'seller' => 'sellerProfile', 'logistics' => 'logisticsProfile',
            };
            $user->$relationship()->create(['first_name' => 'Chat', 'last_name' => ucfirst($user->role->value),
                'contact_number' => '09171234567', 'sex' => 'female', 'birth_date' => '1990-01-01']);
        }
        $shopThread = app(ConversationService::class)->start($buyer, ['shop_id' => $order->shop_id, 'body' => 'Fixture Shop conversation'], (string) Str::uuid())['conversation'];
        $delivery = app(CustomerLogisticsConversationService::class)->start($buyer, 'customer', $order->id, 'Fixture delivery conversation', (string) Str::uuid())['conversation'];
        $buyerCourier = app(CourierCounterpartyConversationService::class)->startFromOrder($buyer, 'customer', $order->id, 'Fixture Courier conversation', (string) Str::uuid())['conversation'];
        $operational = app(OperationalConversationService::class)->start($logistics, 'logistics', ['leg' => 'final_mile', 'task_id' => $task->id, 'body' => 'Fixture operational conversation'], (string) Str::uuid())['conversation'];
        $pickup = $order->waybill->pickupRequest;
        if (! $pickup) {
            $pickup = SellerPickupRequest::findOrFail($order->waybill->seller_pickup_request_id);
        }
        $schedule = PickupSchedule::create(['courier_id' => $courier->id, 'reference' => 'CHAT-PICKUP',
            'starts_at' => now()->addHour(), 'ends_at' => now()->addHours(2), 'idempotency_key' => (string) Str::uuid(),
            'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $organization->hub->id,
            'scheduled_pickup_at' => now()->addHour(), 'status' => 'scheduled', 'created_by' => $logistics->id]);
        $event = $order->statusEvents()->create(['from_status' => OrderStatus::Placed,
            'to_status' => OrderStatus::ReadyForPickup, 'source' => 'seller_pickup', 'occurred_at' => now()]);
        $pickup->orders()->create(['order_id' => $order->id, 'status_event_id' => $event->id, 'position' => 0]);
        $sellerLogistics = app(SellerLogisticsConversationService::class)->start($seller, 'seller', $pickup->id, 'Fixture pickup conversation', (string) Str::uuid())['conversation'];
        // Separate Orders keep first-mile Seller and final-mile Buyer eligibility active together.
        $batch = CheckoutBatch::findOrFail($order->checkout_batch_id);
        $quote = CheckoutQuote::findOrFail($batch->checkout_quote_id)->replicate();
        $quote->save();
        $batch = $batch->replicate();
        $batch->checkout_quote_id = $quote->id;
        $batch->idempotency_key = (string) Str::uuid();
        $batch->save();
        $firstOrder = $order->replicate();
        $firstOrder->checkout_batch_id = $batch->id;
        $firstOrder->reference = 'CHAT-FIRST-ORDER';
        $firstOrder->status = OrderStatus::ReadyForPickup;
        $firstOrder->save();
        $firstBill = $order->waybill->replicate();
        $firstBill->order_id = $firstOrder->id;
        $firstBill->reference = 'CHAT-FIRST-WAYBILL';
        $firstBill->qr_token_hash = hash('sha256', (string) Str::uuid());
        $firstBill->save();
        $firstParcel = $order->parcel->replicate();
        $firstParcel->order_id = $firstOrder->id;
        $firstParcel->waybill_id = $firstBill->id;
        $firstParcel->reference = 'CHAT-FIRST-PARCEL';
        $firstParcel->save();
        $firstShipment = $task->shipment->replicate();
        $firstShipment->parcel_id = $firstParcel->id;
        $firstShipment->save();
        $legacy = FirstMileTask::create(['pickup_schedule_id' => $schedule->id, 'order_id' => $firstOrder->id,
            'waybill_id' => $firstBill->id, 'logistics_organization_id' => $organization->id,
            'logistics_hub_id' => $organization->hub->id, 'courier_id' => $courier->id, 'status' => FirstMileTaskStatus::Accepted]);
        DeliveryTask::create(['shipment_id' => $firstShipment->id, 'leg' => 'first_mile',
            'status' => FulfillmentTaskStatus::SellerPickupAccepted, 'courier_id' => $courier->id, 'legacy_first_mile_task_id' => $legacy->id]);
        $sellerCourier = app(CourierCounterpartyConversationService::class)->startFromOrder($seller, 'seller', $firstOrder->id, 'Fixture Seller Courier conversation', (string) Str::uuid())['conversation'];
        $image = imagecreatetruecolor(120, 60);
        imagefilledrectangle($image, 0, 0, 120, 60, imagecolorallocate($image, 76, 18, 104));
        imagepng($image, $directory.'/photo.png');
        imagedestroy($image);
        $pdf = new Dompdf;
        $pdf->loadHtml('<p>Chat media browser fixture</p>');
        $pdf->render();
        file_put_contents($directory.'/details.pdf', $pdf->output());
        (new Process(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=size=120x60:rate=2', '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-y', $directory.'/clip.mp4']))->mustRun();
        file_put_contents($directory.'/fixture.json', json_encode(['shop_thread' => $shopThread->id,
            'customer_logistics' => $delivery->id, 'customer_courier' => $buyerCourier->id,
            'seller_logistics' => $sellerLogistics->id, 'seller_courier' => $sellerCourier->id,
            'operational' => $operational->id, 'pickup_id' => $pickup->id, 'order_id' => $order->id,
            'shop_id' => $order->shop_id, 'task_id' => $task->id, 'courier_token' => $courier->createToken('chat-browser', ['courier'])->plainTextToken], JSON_PRETTY_PRINT));
        echo "Prepared isolated chat browser fixtures.\n";
    }
}
(new ChatBrowserFixture('prepare'))->prepare($directory);
