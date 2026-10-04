<?php

namespace Tests\Feature\Finance;

use App\Enums\CodInvoiceStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\Finance\DeliverGatewayEvent;
use App\Models\CodRemittanceBatch;
use App\Models\FinanceGatewayEvent;
use App\Models\FinancePaymentAttempt;
use App\Models\Permission;
use App\Models\SandboxGatewayAccount;
use App\Models\User;
use App\Services\Finance\Automation\CodInvoiceService;
use App\Services\Finance\Automation\CollectionService;
use App\Services\Finance\Automation\PaymentResultService;
use App\Services\Finance\Automation\RemittanceService;
use App\Services\Finance\Gateway\SandboxGatewayService;
use Database\Seeders\AdminPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\Support\FinanceAutomationFixtures;
use Tests\TestCase;

class GatewayHttpContractTest extends TestCase
{
    use FinanceAutomationFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Storage::fake('local');
        config(['finance.gateway_enabled' => true]);
    }

    public function test_gateway_http_authentication_idempotency_status_and_lost_response(): void
    {
        $org = $this->logistics('Collector');
        $invoice = app(CodInvoiceService::class)->issue($this->order($org), $org->id, now());
        $attempt = app(CollectionService::class)->pay($org->id, [$invoice->id], (string) Str::uuid());
        $body = $this->body($attempt);
        $this->postJson('/api/v1/sandbox-gateway/payments', $body)->assertForbidden();
        SandboxGatewayAccount::where('reference', $attempt->account_reference)->update(['scenario' => 'lost_response']);
        $headers = ['Authorization' => 'Bearer '.config('finance.gateway_key'), 'Idempotency-Key' => $attempt->idempotency_key];
        $this->withHeaders($headers)->postJson('/api/v1/sandbox-gateway/payments', $body)->assertStatus(504);
        $response = $this->postJson('/api/v1/sandbox-gateway/payments', $body)->assertCreated()->assertJsonPath('data.status', 'pending')->assertJsonPath('data.livemode', false);
        $id = $response->json('data.id');
        $this->getJson('/api/v1/sandbox-gateway/payments/'.$id)->assertOk()->assertJsonPath('data.amount_cents', 60000);
        $this->postJson('/api/v1/sandbox-gateway/payments', [...$body, 'amount_cents' => 1])->assertConflict();
        $this->assertDatabaseCount('sandbox_gateway_transactions', 1);
        config(['finance.gateway_enabled' => false]);
        $this->getJson('/api/v1/sandbox-gateway/payments/'.$id)->assertForbidden();
    }

    public function test_gateway_emits_signed_http_events_and_repeated_resolution_moves_balance_once(): void
    {
        $org = $this->logistics('Collector');
        $invoice = app(CodInvoiceService::class)->issue($this->order($org), $org->id, now());
        $attempt = app(CollectionService::class)->pay($org->id, [$invoice->id], (string) Str::uuid());
        SandboxGatewayAccount::where('reference', $attempt->account_reference)->update(['scenario' => 'duplicate_callback']);
        $gateway = app(SandboxGatewayService::class);
        $transaction = $gateway->create($attempt->idempotency_key, $this->body($attempt));
        $gateway->resolve($transaction->id);
        $gateway->resolve($transaction->id);
        $this->assertSame(99940000, SandboxGatewayAccount::where('reference', $attempt->account_reference)->firstOrFail()->balance_cents);
        $this->assertDatabaseCount('finance_gateway_events', 1);
        Queue::assertPushed(DeliverGatewayEvent::class, 2);
        Http::fake(['*' => Http::response(['received' => true])]);
        $event = FinanceGatewayEvent::firstOrFail();
        (new DeliverGatewayEvent($event->id))->handle();
        Http::assertSent(function ($request) {
            preg_match('/^t=(\d+),v1=([a-f0-9]{64})$/', $request->header('X-Gateway-Signature')[0], $parts);

            return hash_equals(hash_hmac('sha256', $parts[1].'.'.$request->body(), config('finance.webhook_secret')), $parts[2]);
        });
        $this->assertNotNull($event->fresh()->delivered_at);
    }

    public function test_gateway_result_mismatch_cannot_clear_or_release_reservation(): void
    {
        $org = $this->logistics('Collector');
        $invoice = app(CodInvoiceService::class)->issue($this->order($org), $org->id, now());
        $attempt = app(CollectionService::class)->pay($org->id, [$invoice->id], (string) Str::uuid());
        $gateway = app(SandboxGatewayService::class);
        $transaction = $gateway->create($attempt->idempotency_key, $this->body($attempt));
        $object = $gateway->object($gateway->resolve($transaction->id));
        try {
            app(PaymentResultService::class)->apply($attempt->id, [...$object, 'amount_cents' => 1]);
            $this->fail('Mismatched result must be rejected.');
        } catch (HttpException $error) {
            $this->assertSame(409, $error->getStatusCode());
        }
        $this->assertSame(CodInvoiceStatus::Processing, $invoice->fresh()->status);
        $this->assertNull($attempt->fresh()->resolved_at);
    }

    public function test_manual_receipt_rejection_preserves_history_and_legacy_partial_cleared_balance(): void
    {
        $this->seed(AdminPermissionSeeder::class);
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $admin->permissions()->attach(Permission::whereIn('slug', ['finance.view', 'finance.manage'])->pluck('id'));
        $org = $this->logistics('Collector');
        $order = $this->order($org);
        $legacy = CodRemittanceBatch::create(['logistics_organization_id' => $org->id, 'reference' => 'OLD', 'currency' => 'PHP', 'total_cents' => 10000, 'status' => 'cleared', 'submitted_at' => now(), 'cleared_at' => now()]);
        $legacy->allocations()->create(['order_id' => $order->id, 'amount_cents' => 10000]);
        $invoice = app(CodInvoiceService::class)->issue($order, $org->id, now());
        $batch = app(RemittanceService::class)->submit($org->user, 'MANUAL', 'PHP', [['order_id' => $order->id, 'amount_cents' => 50000]]);
        $this->actingAs($admin)->postJson('/api/v1/admin/finance/remittances/'.$batch->id.'/reject', [])->assertUnprocessable();
        $this->postJson('/api/v1/admin/finance/remittances/'.$batch->id.'/reject', ['reason' => 'Bank reference not verified'])->assertOk();
        $this->assertSame(CodInvoiceStatus::Outstanding, $invoice->fresh()->status);
        $this->assertDatabaseCount('cod_remittance_allocations', 2);
        $attempt = app(CollectionService::class)->pay($org->id, [$invoice->id], (string) Str::uuid());
        $this->assertSame(50000, $attempt->amount_cents);
    }

    private function body(FinancePaymentAttempt $attempt): array
    {
        return ['direction' => $attempt->direction->value, 'amount_cents' => $attempt->amount_cents,
            'currency' => $attempt->currency, 'account_reference' => $attempt->account_reference,
            'metadata' => ['attempt_id' => $attempt->id]];
    }
}
