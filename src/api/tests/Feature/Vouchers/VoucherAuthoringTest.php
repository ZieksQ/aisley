<?php

namespace Tests\Feature\Vouchers;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PlatformPolicy;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\VoucherAuthoringFixtures;
use Tests\TestCase;

class VoucherAuthoringTest extends TestCase
{
    use RefreshDatabase, VoucherAuthoringFixtures;

    public function test_auth_roles_permissions_approval_and_consent_gate_all_routes(): void
    {
        $this->getJson('/api/v1/admin/vouchers')->assertUnauthorized();
        $admin = $this->voucherActor('admin', false);
        $this->getJson('/api/v1/admin/vouchers')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->postJson('/api/v1/admin/vouchers', $this->voucherTerms())->assertForbidden();
        $admin->permissions()->detach();
        $this->getJson('/api/v1/admin/vouchers')->assertForbidden();
        $seller = $this->voucherActor('seller');
        $this->getJson('/api/v1/admin/vouchers')->assertForbidden();
        $seller->update(['status' => UserStatus::Pending]);
        $this->getJson('/api/v1/seller/vouchers')->assertForbidden()->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');
        $seller->update(['status' => UserStatus::Active]);
        $policy = PlatformPolicy::create(['type' => 'terms_of_service', 'title' => 'Terms']);
        $version = $policy->versions()->create(['version' => 1, 'status' => 'published', 'title' => 'Terms', 'content' => 'Required', 'published_at' => now(), 'created_by_admin_id' => $admin->id, 'requires_reconsent' => true]);
        $policy->update(['current_version_id' => $version->id]);
        $this->getJson('/api/v1/seller/vouchers')->assertForbidden()->assertJsonPath('code', 'POLICY_CONSENT_REQUIRED');
        $this->actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]))->getJson('/api/v1/seller/vouchers')->assertForbidden();
    }

    public function test_complete_drafts_validate_terms_forbid_managed_fields_and_normalize_unique_codes(): void
    {
        $this->voucherActor();
        foreach ([['value' => 0], ['value_type' => 'percent', 'value' => 101], ['per_customer_limit' => 0], ['global_limit' => 0], ['maximum_discount' => 0], ['ends_at' => now()->subDay()->toISOString()], ['terms_summary' => '<b>Sale</b>'], ['starts_at' => '2026-10-08 10:00:00'], ['shop_id' => null], ['eligibility_rules' => []], ['redeemed_count' => 0], ['lifecycle' => 'published']] as $bad) {
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/admin/vouchers', $this->voucherTerms($bad))->assertUnprocessable();
        }
        $data = $this->draftVoucher('admin', ['code' => ' simple sale ']);
        $this->assertSame('SIMPLE-SALE', $data['code']);
        $this->assertSame(['draft', false, 0, '0.00', 1], [$data['status'], $data['is_active'], $data['redeemed_count'], $data['terms']['minimum_spend'], $data['terms']['per_customer_limit']]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/admin/vouchers', $this->voucherTerms(['code' => 'simple sale']))->assertUnprocessable()->assertJsonValidationErrors('code');
        $this->voucherActor('seller');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/vouchers', $this->voucherTerms(['benefit_type' => 'shipping']))->assertUnprocessable();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/vouchers', $this->voucherTerms(['code' => 'SIMPLE-SALE']))->assertUnprocessable();
    }

    public function test_initial_codes_are_generated_editable_and_scheduled_without_activation_jobs(): void
    {
        $this->voucherActor();
        $data = $this->voucherTerms(['starts_at' => now()->addDay()->toISOString()]);
        unset($data['code']);
        $draft = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/admin/vouchers', $data)->assertCreated()->json('data');
        $this->assertMatchesRegularExpression('/^AIS-[A-Z0-9]{12}$/', $draft['code']);
        $saved = $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$draft['id'].'/draft', [...$data, 'revision' => $draft['revision'], 'code' => 'updated-code'])->assertOk()->assertJsonPath('data.code', 'UPDATED-CODE')->json('data');
        $live = $this->voucherAction($saved, 'publish')->assertOk()->assertJsonPath('data.status', 'scheduled')->json('data');
        $this->travel(2)->days();
        $this->getJson('/api/v1/admin/vouchers?status=active')->assertOk()->assertJsonPath('meta.total', 1);
        $this->travel(8)->days();
        $this->getJson('/api/v1/admin/vouchers/'.$live['id'])->assertOk()->assertJsonPath('data.status', 'expired');
        $version = Voucher::findOrFail($live['id'])->versions()->sole();
        try {
            $version->update(['terms' => ['code' => 'REWRITE']]);
            $this->fail('Published versions must be immutable.');
        } catch (\LogicException $error) {
            $this->assertStringContainsString('immutable', $error->getMessage());
        }
        $action = VoucherAction::where('voucher_id', $live['id'])->firstOrFail();
        try {
            $action->delete();
            $this->fail('Action history must be append-only.');
        } catch (\LogicException $error) {
            $this->assertStringContainsString('append-only', $error->getMessage());
        }
    }

    public function test_legacy_published_display_code_is_preserved_while_new_codes_are_normalized(): void
    {
        $this->voucherActor();
        $live = $this->voucherAction($this->draftVoucher(), 'publish')->assertOk()->json('data');
        Voucher::findOrFail($live['id'])->update(['code' => 'legacy_lowercase']);
        $working = $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$live['id'].'/draft', $this->voucherTerms(['code' => 'legacy_lowercase', 'revision' => $live['revision'], 'value' => 25]))->assertOk()->json('data');
        $this->voucherAction($working, 'publish')->assertOk()->assertJsonPath('data.code', 'legacy_lowercase');
    }

    public function test_seller_foreign_vouchers_are_hidden_for_all_reads_and_mutations(): void
    {
        $this->voucherActor('seller');
        $own = $this->draftVoucher('seller');
        $this->voucherActor('seller');
        $this->getJson('/api/v1/seller/vouchers')->assertJsonCount(0, 'data');
        foreach (['', '/versions', '/actions', '/redemptions'] as $suffix) {
            $this->getJson('/api/v1/seller/vouchers/'.$own['id'].$suffix)->assertNotFound();
        }
        foreach (['publish', 'duplicate', 'pause', 'resume', 'end', 'discard'] as $action) {
            $this->voucherAction($own, $action, 'seller')->assertNotFound();
        }
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/seller/vouchers/'.$own['id'].'/draft', $this->voucherTerms(['revision' => $own['revision']]))->assertNotFound();
        $this->voucherActor();
        $this->getJson('/api/v1/admin/vouchers/'.$own['id'])->assertNotFound();
    }

    public function test_replacement_publication_preserves_live_terms_usage_pause_and_history(): void
    {
        $this->voucherActor();
        $draft = $this->draftVoucher();
        $live = $this->voucherAction($draft, 'publish')->assertOk()->json('data');
        $this->assertSame('active', $live['status']);
        Voucher::findOrFail($live['id'])->update(['redeemed_count' => 3]);
        $paused = $this->voucherAction($live, 'pause')->assertOk()->json('data');
        $working = $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$live['id'].'/draft', $this->voucherTerms(['code' => $live['code'], 'revision' => $paused['revision'], 'value' => 200, 'global_limit' => 2]))->assertOk()->json('data');
        $this->assertSame('100.00', $working['terms']['value']);
        $this->assertSame('200.00', $working['draft']['terms']['value']);
        $this->voucherAction($working, 'publish')->assertConflict()->assertJsonPath('code', 'LIMIT_BELOW_USAGE');
        $working = $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$live['id'].'/draft', $this->voucherTerms(['code' => $live['code'], 'revision' => $working['revision'], 'value' => 200, 'global_limit' => 3]))->assertOk()->json('data');
        $replacement = $this->voucherAction($working, 'publish')->assertOk()->json('data');
        $this->assertSame(['paused', 2, 3, 0, '200.00', null], [$replacement['status'], $replacement['version'], $replacement['redeemed_count'], $replacement['remaining_capacity'], $replacement['terms']['value'], $replacement['draft']]);
        $resumed = $this->voucherAction($replacement, 'resume')->assertOk()->json('data');
        $this->assertSame('exhausted', $resumed['status']);
        $this->getJson('/api/v1/admin/vouchers/'.$live['id'].'/versions')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.1.terms.value', '100.00');
        $this->getJson('/api/v1/admin/vouchers/'.$live['id'].'/actions')->assertOk()->assertJsonPath('meta.total', 7);
    }

    public function test_identity_schedule_discard_end_duplication_and_legacy_boundaries(): void
    {
        $this->voucherActor();
        $live = $this->voucherAction($this->draftVoucher(), 'publish')->assertOk()->json('data');
        foreach ([['code' => 'CHANGED'], ['benefit_type' => 'shipping']] as $bad) {
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$live['id'].'/draft', $this->voucherTerms(['code' => $live['code'], 'revision' => $live['revision'], ...$bad]))->assertUnprocessable();
        }
        $working = $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$live['id'].'/draft', $this->voucherTerms(['code' => $live['code'], 'revision' => $live['revision'], 'starts_at' => now()->addDay()->toISOString()]))->assertOk()->json('data');
        $this->voucherAction($working, 'publish')->assertConflict()->assertJsonPath('code', 'REPLACEMENT_NOT_STARTED');
        $discarded = $this->voucherAction($working, 'discard')->assertOk()->json('data');
        $this->assertNull($discarded['draft']);
        $ended = $this->voucherAction($discarded, 'end')->assertOk()->json('data');
        foreach (['publish', 'resume', 'pause'] as $action) {
            $this->voucherAction($ended, $action)->assertConflict()->assertJsonPath('code', 'VOUCHER_ENDED');
        }
        $copy = $this->voucherAction($ended, 'duplicate')->assertCreated()->json('data');
        $this->assertNotSame($ended['code'], $copy['code']);
        $this->assertSame(['draft', 0, 0], [$copy['status'], $copy['version'], $copy['redeemed_count']]);
        $this->voucherAction($copy, 'discard')->assertConflict();
        Voucher::findOrFail($copy['id'])->update(['eligibility_rules' => ['product_ids' => [(string) Str::uuid()]]]);
        $this->voucherAction($copy, 'duplicate')->assertUnprocessable();
        $this->getJson('/api/v1/admin/vouchers/'.$copy['id'])->assertOk()->assertJsonPath('data.authoring_supported', false);
    }

    public function test_legacy_customer_targeting_remains_stored_but_is_redacted_from_detail_and_history(): void
    {
        $this->voucherActor();
        $live = $this->voucherAction($this->draftVoucher(), 'publish')->assertOk()->json('data');
        $customer = (string) Str::uuid();
        $voucher = Voucher::findOrFail($live['id']);
        $voucher->update(['eligibility_rules' => ['customer_ids' => [$customer]]]);
        $version = $voucher->versions()->sole();
        // Simulate a pre-authoring targeted baseline without mutating immutable models.
        $terms = $version->terms;
        $terms['eligibility_rules'] = ['customer_ids' => [$customer]];
        DB::table('voucher_versions')->where('id', $version->id)->update(['terms' => json_encode($terms)]);
        $detail = $this->getJson('/api/v1/admin/vouchers/'.$live['id'])->assertOk()->assertJsonPath('data.authoring_supported', false)->assertJsonPath('data.terms.eligibility_scope', 'legacy_targeted');
        $history = $this->getJson('/api/v1/admin/vouchers/'.$live['id'].'/versions')->assertOk()->assertJsonPath('data.0.terms.eligibility_scope', 'legacy_targeted');
        $this->assertStringNotContainsString($customer, $detail->getContent());
        $this->assertStringNotContainsString($customer, $history->getContent());
        $this->assertSame([$customer], $voucher->fresh()->eligibility_rules['customer_ids']);
    }

    public function test_mutation_replay_changed_payload_stale_revision_and_paginated_filters(): void
    {
        $this->voucherActor();
        $key = (string) Str::uuid();
        $terms = $this->voucherTerms();
        $first = $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/admin/vouchers', $terms)->assertCreated()->json();
        $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/admin/vouchers', $terms)->assertCreated()->assertExactJson($first);
        $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/admin/vouchers', [...$terms, 'value' => 500])->assertConflict()->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
        $draft = $first['data'];
        $publishKey = (string) Str::uuid();
        $published = $this->voucherAction($draft, 'publish', key: $publishKey)->assertOk()->json();
        $this->voucherAction($draft, 'publish', key: $publishKey)->assertOk()->assertExactJson($published);
        $this->voucherAction($draft, 'end')->assertConflict()->assertJsonPath('code', 'REVISION_CONFLICT');
        $this->assertDatabaseCount('voucher_mutation_receipts', 2);
        $this->assertDatabaseCount('voucher_versions', 1);
        $this->getJson('/api/v1/admin/vouchers?status=active&benefit=discount&search='.$terms['code'])->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/v1/admin/vouchers?status=draft')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/admin/vouchers?status=invalid')->assertUnprocessable();
    }
}
