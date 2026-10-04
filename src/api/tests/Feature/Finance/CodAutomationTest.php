<?php

namespace Tests\Feature\Finance;

use App\Enums\CodInvoiceStatus;
use App\Enums\FinancePaymentStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\Finance\ProcessFinanceWebhook;
use App\Jobs\Finance\SubmitFinancePayment;
use App\Models\CodRemittanceBatch;
use App\Models\FinanceGatewayEvent;
use App\Models\FinanceJournalEntry;
use App\Models\FinancePaymentAttempt;
use App\Models\FinancePayoutItem;
use App\Models\FinanceWebhookReceipt;
use App\Models\FinancialHold;
use App\Models\LogisticsServiceAllocation;
use App\Models\Permission;
use App\Models\User;
use App\Services\Finance\Automation\CodInvoiceService;
use App\Services\Finance\Automation\CollectionService;
use App\Services\Finance\Automation\FinanceAutomationService;
use App\Services\Finance\Automation\FinanceNoticeService;
use App\Services\Finance\Automation\FinanceSettingsService;
use App\Services\Finance\Automation\PaymentResultService;
use App\Services\Finance\Automation\PayoutService;
use App\Services\Finance\Gateway\GatewayClient;
use App\Services\Finance\Gateway\SandboxGatewayService;
use Database\Seeders\AdminPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Support\FinanceAutomationFixtures;
use Tests\TestCase;

class CodAutomationTest extends TestCase
{
    use FinanceAutomationFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Storage::fake('local');
        config(['finance.gateway_enabled' => true]);
        $this->travelTo(now()->setDate(2026, 10, 5)->setTime(0, 0));
    }

    public function test_invoice_is_unique_collector_owned_and_preserves_deadlines(): void
    {
        $pickup = $this->logistics('Pickup');
        $collector = $this->logistics('Final mile');
        $order = $this->order($pickup);
        $invoice = app(CodInvoiceService::class)->issue($order, $collector->id, now());
        $same = app(CodInvoiceService::class)->issue($order, $pickup->id, now()->addDay());
        $this->assertTrue($same->is($invoice));
        $this->assertSame($collector->id, $invoice->logistics_organization_id);
        foreach (['due_at' => 72, 'seller_eligible_at' => 336, 'logistics_eligible_at' => 24] as $field => $hours) {
            $this->assertSame($hours, (int) $invoice->delivered_at->diffInHours($invoice->{$field}));
        }
        app(FinanceSettingsService::class)->platform()->update(['cod_deadline_hours' => 48]);
        $this->assertSame(72, (int) $invoice->fresh()->delivered_at->diffInHours($invoice->fresh()->due_at));
        $this->actingAs($pickup->user)->getJson('/api/v1/logistics/finance/invoices/'.$invoice->id)->assertNotFound();
        $this->actingAs($collector->user)->getJson('/api/v1/logistics/finance/invoices/'.$invoice->id)->assertOk()->assertJsonPath('data.remaining_cents', 60000);
        $this->getJson('/api/v1/logistics/finance/invoices')->assertOk()->assertJsonPath('summary.outstanding_cents', 60000)->assertJsonPath('summary.overdue_cents', 0);
    }

    public function test_gateway_success_signed_duplicate_and_receipt(): void
    {
        [$org, $invoice] = $this->invoice();
        $key = (string) Str::uuid();
        $attempt = app(CollectionService::class)->pay($org->id, [$invoice->id], $key);
        $this->assertTrue($attempt->is(app(CollectionService::class)->pay($org->id, [$invoice->id], $key)));
        $this->resolvePayment($attempt);
        $event = FinanceGatewayEvent::firstOrFail();
        $this->postSigned($event->payload)->assertOk();
        $receipt = FinanceWebhookReceipt::firstOrFail();
        (new ProcessFinanceWebhook($receipt->id))->handle(app(PaymentResultService::class));
        $this->postSigned($event->payload)->assertOk();
        (new ProcessFinanceWebhook($receipt->id))->handle(app(PaymentResultService::class));
        $this->assertSame(CodInvoiceStatus::Paid, $invoice->fresh()->status);
        $this->assertSame(1, FinanceJournalEntry::where('event_type', 'cod_remitted')->count());
        $this->actingAs($org->user)->get('/api/v1/logistics/finance/remittances/'.$attempt->cod_remittance_batch_id.'/receipt')->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_pending_blocks_second_payment_and_failure_releases_for_retry(): void
    {
        [$org, $invoice] = $this->invoice();
        $attempt = app(CollectionService::class)->pay($org->id, [$invoice->id], (string) Str::uuid());
        $this->actingAs($org->user)->postJson('/api/v1/logistics/finance/invoice-payments', ['invoice_ids' => [$invoice->id], 'idempotency_key' => (string) Str::uuid()])->assertUnprocessable();
        $this->resolvePayment($attempt, 'insufficient_funds');
        $this->assertSame(CodInvoiceStatus::Outstanding, $invoice->fresh()->status);
        $retry = app(CollectionService::class)->pay($org->id, [$invoice->id], (string) Str::uuid());
        $this->assertNotSame($attempt->id, $retry->id);
        $this->assertDatabaseCount('cod_remittance_allocations', 2);
    }

    public function test_partial_amount_payload_reuse_and_forged_callbacks_are_rejected(): void
    {
        [$org, $invoice] = $this->invoice();
        $this->actingAs($org->user)->postJson('/api/v1/logistics/finance/remittances', ['reference' => 'PARTIAL', 'currency' => 'PHP', 'allocations' => [['order_id' => $invoice->order_id, 'amount_cents' => 100]]])->assertUnprocessable();
        $key = (string) Str::uuid();
        app(CollectionService::class)->pay($org->id, [$invoice->id], $key);
        $other = app(CodInvoiceService::class)->issue($this->order($org), $org->id, now());
        $this->postJson('/api/v1/logistics/finance/invoice-payments', ['invoice_ids' => [$other->id], 'idempotency_key' => $key])->assertConflict();
        $this->postJson('/api/v1/finance/gateway/webhook', ['id' => Str::uuid()])->assertBadRequest();
        $this->assertDatabaseCount('finance_webhook_receipts', 0);
    }

    public function test_custom_schedule_recovers_missed_tick_and_does_not_repeat(): void
    {
        [$org, $invoice] = $this->invoice();
        app(FinanceSettingsService::class)->collection($org->id)->update(['collection_time' => '10:30']);
        $this->travelTo(now()->setTime(2, 29));
        $this->assertSame(0, app(FinanceAutomationService::class)->tick());
        $this->travelTo(now()->setTime(2, 45));
        $this->assertSame(1, app(FinanceAutomationService::class)->tick());
        $this->assertSame(0, app(FinanceAutomationService::class)->tick());
        $this->assertDatabaseCount('finance_payment_attempts', 1);
        $this->assertSame(CodInvoiceStatus::Processing, $invoice->fresh()->status);
    }

    public function test_separate_waits_and_early_logistics_still_require_funding_and_no_holds(): void
    {
        [$org, $invoice] = $this->invoice();
        $this->fund($invoice->order, $org);
        LogisticsServiceAllocation::where('order_id', $invoice->order_id)->update(['status' => 'reconciled']);
        $service = app(PayoutService::class);
        $this->assertContains('COD not fully remitted', $service->obligations('logistics', $org->id, true)[0]['blocked']);
        $this->resolvePayment(app(CollectionService::class)->pay($org->id, [$invoice->id], (string) Str::uuid()));
        $this->assertSame(['Waiting period'], $service->obligations('logistics', $org->id)[0]['blocked']);
        $this->assertSame([], $service->obligations('logistics', $org->id, true)[0]['blocked']);
        $this->travel(24)->hours();
        $this->assertSame([], $service->obligations('logistics', $org->id)[0]['blocked']);
        $this->assertSame(['Waiting period'], $service->obligations('seller', $invoice->order->shop_id)[0]['blocked']);
        $this->travel(13)->days();
        $this->assertSame([], $service->obligations('seller', $invoice->order->shop_id)[0]['blocked']);
        FinancialHold::create(['order_id' => $invoice->order_id, 'reason_code' => 'MANUAL_REVIEW', 'placed_at' => now()]);
        $this->assertContains('Financial hold', $service->obligations('logistics', $org->id, true)[0]['blocked']);
    }

    public function test_failed_payout_retains_items_reverses_and_retries_once(): void
    {
        [$org, $invoice] = $this->invoice();
        $this->fund($invoice->order, $org);
        $this->resolvePayment(app(CollectionService::class)->pay($org->id, [$invoice->id], (string) Str::uuid()));
        $payout = app(PayoutService::class)->pay('logistics', $org->id, [$invoice->order_id], (string) Str::uuid(), true);
        $this->resolvePayment($payout, 'failure');
        $this->assertNotNull(FinancePayoutItem::firstOrFail()->released_at);
        $retry = app(PayoutService::class)->pay('logistics', $org->id, [$invoice->order_id], (string) Str::uuid(), true);
        $this->resolvePayment($retry);
        $this->assertDatabaseCount('finance_payout_items', 2);
        $this->assertSame(1, FinanceJournalEntry::where('event_type', 'sandbox_payout_succeeded')->count());
        $this->assertNull(app(PayoutService::class)->pay('logistics', $org->id, [$invoice->order_id], (string) Str::uuid(), true));
    }

    public function test_admin_settings_permissions_and_logistics_limits(): void
    {
        $this->seed(AdminPermissionSeeder::class);
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $this->actingAs($admin)->getJson('/api/v1/admin/finance/automation')->assertForbidden();
        $admin->permissions()->attach(Permission::where('slug', 'finance.view')->firstOrFail());
        $this->getJson('/api/v1/admin/finance/automation')->assertOk()->assertJsonPath('data.platform.cod_deadline_hours', 72);
        $this->patchJson('/api/v1/admin/finance/automation', ['seller_delay_hours' => 240])->assertForbidden();
        $admin->permissions()->attach(Permission::where('slug', 'finance.manage')->firstOrFail());
        $this->patchJson('/api/v1/admin/finance/automation', ['seller_delay_hours' => 240])->assertOk();
        [$org] = $this->invoice();
        $this->actingAs($org->user)->patchJson('/api/v1/logistics/finance/automation', ['collection_time' => '11:00', 'seller_delay_hours' => 1])->assertOk();
        $this->assertSame(240, app(FinanceSettingsService::class)->platform()->seller_delay_hours);
        $this->getJson('/api/v1/seller/finance/invoices')->assertNotFound();
        $this->getJson('/api/v1/admin/finance/invoices')->assertForbidden();
    }

    public function test_pdf_and_notifications_are_private_and_deduplicated(): void
    {
        [$org, $invoice] = $this->invoice();
        app(FinanceNoticeService::class)->dispatchPending();
        app(FinanceNoticeService::class)->dispatchPending();
        $this->assertSame(1, $org->user->notifications()->count());
        $this->actingAs($org->user)->get('/api/v1/logistics/finance/invoices/'.$invoice->id.'/pdf')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->getJson('/api/v1/logistics/notifications')->assertOk()->assertJsonPath('data.0.destination', '/finance/remittances/invoices/'.$invoice->id);
        $other = $this->logistics('Other');
        $this->actingAs($other->user)->get('/api/v1/logistics/finance/invoices/'.$invoice->id.'/pdf')->assertNotFound();
        $this->travel(73)->hours();
        app(FinanceNoticeService::class)->dispatchPending();
        app(FinanceNoticeService::class)->dispatchPending();
        $this->assertSame(2, $org->user->notifications()->count());
    }

    public function test_unknown_response_keeps_reservation_and_retries_same_identity(): void
    {
        [$org, $invoice] = $this->invoice();
        $attempt = app(CollectionService::class)->pay($org->id, [$invoice->id], (string) Str::uuid());
        Http::fake(['*' => Http::response(['message' => 'Timeout'], 504)]);
        try {
            (new SubmitFinancePayment($attempt->id))->handle(app(GatewayClient::class), app(PaymentResultService::class));
            $this->fail('Expected gateway timeout.');
        } catch (RequestException) {
            $this->assertSame(FinancePaymentStatus::Unknown, $attempt->fresh()->status);
        }
        $this->assertSame(CodInvoiceStatus::Processing, $invoice->fresh()->status);
        $this->assertSame('submitted', CodRemittanceBatch::firstOrFail()->status);
        $object = $this->resolvePayment($attempt);
        Http::fake(['*' => Http::response(['data' => $object])]);
        (new SubmitFinancePayment($attempt->id))->handle(app(GatewayClient::class), app(PaymentResultService::class));
        $this->assertSame(FinancePaymentStatus::Succeeded, $attempt->fresh()->status);
    }

    private function invoice(): array
    {
        $org = $this->logistics('Collector '.Str::uuid());

        return [$org, app(CodInvoiceService::class)->issue($this->order($org), $org->id, now())];
    }

    private function resolvePayment(FinancePaymentAttempt $attempt, ?string $outcome = null): array
    {
        $gateway = app(SandboxGatewayService::class);
        $transaction = $gateway->create($attempt->idempotency_key, ['direction' => $attempt->direction->value, 'amount_cents' => $attempt->amount_cents, 'currency' => $attempt->currency, 'account_reference' => $attempt->account_reference, 'metadata' => ['attempt_id' => $attempt->id]]);
        $object = $gateway->object($gateway->resolve($transaction->id, $outcome));
        app(PaymentResultService::class)->apply($attempt->id, $object);

        return $object;
    }

    private function postSigned(array $payload)
    {
        $body = json_encode($payload, JSON_THROW_ON_ERROR);
        $timestamp = now()->timestamp;
        $signature = hash_hmac('sha256', $timestamp.'.'.$body, config('finance.webhook_secret'));

        return $this->call('POST', '/api/v1/finance/gateway/webhook', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_GATEWAY_SIGNATURE' => 't='.$timestamp.',v1='.$signature], $body);
    }
}
