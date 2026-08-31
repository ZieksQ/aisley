<?php

namespace Tests\Feature\Admin;

use App\Enums\AddressType;
use App\Enums\ProductStatus;
use App\Enums\SellerComplianceActionType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Address;
use App\Models\AdminPermission;
use App\Models\Permission;
use App\Models\Product;
use App\Models\SellerComplianceCase;
use App\Models\User;
use App\Notifications\Seller\SellerComplianceNotification;
use Database\Seeders\AdminPermissionSeeder;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

class SellerComplianceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProductSeeder::class);
    }

    public function test_guest_non_admin_and_admin_without_permission_are_denied(): void
    {
        $this->getJson('/api/v1/admin/seller-compliance/cases')->assertUnauthorized();

        $seller = $this->seller();
        $this->actingAs($seller)->getJson('/api/v1/admin/seller-compliance/cases')->assertForbidden();

        $admin = $this->admin();
        $this->actingAs($admin)->getJson('/api/v1/admin/seller-compliance/cases')->assertForbidden();
    }

    public function test_admin_can_create_search_and_view_a_safe_manual_case(): void
    {
        $admin = $this->admin('seller_compliance.manage');
        $seller = $this->seller();
        $product = $this->product();

        $response = $this->actingAs($admin)->postJson('/api/v1/admin/seller-compliance/cases', [
            'seller_id' => $seller->id,
            'product_id' => $product->id,
            'reason' => 'The listing requires a manual policy review.',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.seller.id', $seller->id)
            ->assertJsonPath('data.product.id', $product->id)
            ->assertJsonPath('data.source.type', 'manual_admin_review')
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('meta.request_id', fn ($value) => is_string($value));

        $caseId = $response->json('data.id');
        $this->actingAs($admin)->getJson('/api/v1/admin/seller-compliance/cases?search=manual+policy&status=open')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $caseId);

        $encoded = json_encode($response->json(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('password', $encoded);
        $this->assertStringNotContainsString('document', $encoded);
        $this->assertDatabaseHas('audit_logs', ['action' => 'seller_compliance.case_created']);
    }

    public function test_case_rejects_a_product_owned_by_another_seller(): void
    {
        $admin = $this->admin('seller_compliance.manage');
        $otherSeller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $otherSeller->sellerProfile()->create([
            'first_name' => 'Other', 'last_name' => 'Seller', 'contact_number' => '09170000000',
            'sex' => 'prefer_not_to_say', 'birth_date' => '1990-01-01',
        ]);
        $sourceShop = $this->seller()->shop;
        $otherSeller->shop()->create([
            'shop_category_id' => $sourceShop->shop_category_id,
            'name' => 'Other Shop', 'slug' => 'other-shop', 'status' => 'active', 'is_on_vacation' => false,
        ]);

        $this->actingAs($admin)->postJson('/api/v1/admin/seller-compliance/cases', [
            'seller_id' => $otherSeller->id,
            'product_id' => $this->product()->id,
            'reason' => 'Cross-Seller Product reference must fail.',
        ])->assertNotFound();

        $this->assertDatabaseCount('seller_compliance_cases', 0);
    }

    public function test_warning_restriction_revocation_and_closure_are_immutable_and_idempotent(): void
    {
        Notification::fake();
        $admin = $this->admin('seller_compliance.manage');
        $seller = $this->seller();
        $product = Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();
        $case = $this->createCase($admin, $seller, $product);

        $warningKey = (string) Str::uuid();
        $warning = ['expected_revision' => 1, 'idempotency_key' => $warningKey, 'reason' => 'Remove the unsupported safety claim from this listing.'];
        $this->actingAs($admin)->postJson("/api/v1/admin/seller-compliance/cases/{$case->id}/warn", $warning)
            ->assertOk()->assertJsonPath('data.status', 'confirmed')->assertJsonPath('data.revision', 2);
        $this->actingAs($admin)->postJson("/api/v1/admin/seller-compliance/cases/{$case->id}/warn", $warning)
            ->assertOk()->assertJsonPath('data.revision', 2);

        $this->actingAs($admin)->postJson("/api/v1/admin/seller-compliance/cases/{$case->id}/restrict-product", [
            'expected_revision' => 2,
            'idempotency_key' => (string) Str::uuid(),
            'reason' => 'Listing is hidden until the prohibited claim is corrected.',
        ])->assertOk()->assertJsonPath('data.product.is_restricted', true)->assertJsonPath('data.revision', 3);

        $this->getJson('/api/v1/products/'.$product->id)->assertNotFound();
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($customer)->postJson('/api/v1/customer/cart/items', [
            'product_id' => $product->id, 'variant_id' => null, 'quantity' => 1,
        ])->assertConflict()->assertJsonPath('code', 'PRODUCT_UNAVAILABLE');
        $address = Address::create([
            'user_id' => $customer->id, 'type' => AddressType::Shipping, 'label' => 'Home',
            'recipient_name' => 'Compliance Buyer', 'contact_number' => '09171234567',
            'address_line_1' => '123 Test Street', 'barangay' => 'San Antonio',
            'city_municipality' => 'Makati City', 'province' => 'Metro Manila',
            'region' => 'NCR', 'postal_code' => '1203', 'country' => 'Philippines',
        ]);
        $this->postJson('/api/v1/customer/checkout/quote', [
            'mode' => 'buy_now',
            'buy_now' => ['product_id' => $product->id, 'variant_id' => null, 'quantity' => 1],
            'address_id' => $address->id,
            'payment_method' => 'cod',
            'vouchers' => [],
        ])->assertConflict()->assertJsonPath('code', 'PRODUCT_UNAVAILABLE');

        $product->update(['status' => ProductStatus::Draft, 'published_at' => null]);
        $this->actingAs($seller)->postJson("/api/v1/seller/products/{$product->id}/publish")
            ->assertConflict();

        $this->actingAs($admin)->postJson("/api/v1/admin/seller-compliance/cases/{$case->id}/revoke-product-restriction", [
            'expected_revision' => 3,
            'idempotency_key' => (string) Str::uuid(),
            'reason' => 'The Seller corrected the listing content.',
        ])->assertOk()->assertJsonPath('data.product.is_restricted', false)->assertJsonPath('data.revision', 4);

        $this->actingAs($admin)->postJson("/api/v1/admin/seller-compliance/cases/{$case->id}/close", [
            'expected_revision' => 4,
            'idempotency_key' => (string) Str::uuid(),
            'reason' => 'Required compliance actions are complete.',
        ])->assertOk()->assertJsonPath('data.status', 'closed')->assertJsonPath('data.revision', 5);

        $this->assertDatabaseCount('product_compliance_restrictions', 1);
        $this->assertDatabaseCount('seller_compliance_actions', 4);
        $this->assertDatabaseHas('seller_compliance_actions', ['action' => SellerComplianceActionType::WarningIssued->value]);
        $this->assertDatabaseHas('seller_compliance_actions', ['action' => SellerComplianceActionType::ProductRestricted->value]);
        $this->assertDatabaseHas('seller_compliance_actions', ['action' => SellerComplianceActionType::ProductRestrictionRevoked->value]);
        $this->assertDatabaseHas('seller_compliance_actions', ['action' => SellerComplianceActionType::CaseClosed->value]);
        Notification::assertSentToTimes($seller, SellerComplianceNotification::class, 3);
    }

    public function test_dismissal_closes_without_changing_product_or_seller_access(): void
    {
        $admin = $this->admin('seller_compliance.manage');
        $seller = $this->seller();
        $product = $this->product();
        $case = $this->createCase($admin, $seller, $product);

        $this->actingAs($admin)->postJson("/api/v1/admin/seller-compliance/cases/{$case->id}/dismiss", [
            'expected_revision' => 1,
            'idempotency_key' => (string) Str::uuid(),
            'reason' => 'The listing complies with the reviewed rule.',
        ])->assertOk()->assertJsonPath('data.status', 'dismissed');

        $this->assertSame(UserStatus::Active, $seller->fresh()->status);
        $this->assertFalse($product->fresh()->isComplianceRestricted());
        $this->getJson('/api/v1/products/'.$product->id)->assertOk();
    }

    public function test_suspension_referral_uses_account_lifecycle_and_exact_seller_identity(): void
    {
        $admin = $this->admin('seller_compliance.manage');
        $seller = $this->seller();
        $case = $this->createCase($admin, $seller);
        $payload = [
            'expected_revision' => 1,
            'idempotency_key' => (string) Str::uuid(),
            'reason' => 'Repeated severe marketplace policy violations.',
            'confirmation' => 'wrong@example.com/seller',
        ];

        $this->actingAs($admin)->postJson("/api/v1/admin/seller-compliance/cases/{$case->id}/suspend-seller", $payload)
            ->assertConflict();
        $this->assertSame(UserStatus::Active, $seller->fresh()->status);

        $payload['confirmation'] = $seller->email.'/seller';
        $this->actingAs($admin)->postJson("/api/v1/admin/seller-compliance/cases/{$case->id}/suspend-seller", $payload)
            ->assertOk()->assertJsonPath('data.status', 'confirmed');

        $this->assertSame(UserStatus::Suspended, $seller->fresh()->status);
        $this->assertDatabaseHas('account_lifecycle_events', [
            'user_id' => $seller->id,
            'source_feature' => 'seller_compliance',
            'source_reference_id' => $case->id,
        ]);
        $this->getJson('/api/v1/products/'.$this->product()->id)->assertNotFound();
    }

    public function test_stale_revision_does_not_append_an_action(): void
    {
        $admin = $this->admin('seller_compliance.manage');
        $case = $this->createCase($admin, $this->seller());

        $this->actingAs($admin)->postJson("/api/v1/admin/seller-compliance/cases/{$case->id}/warn", [
            'expected_revision' => 99,
            'idempotency_key' => (string) Str::uuid(),
            'reason' => 'This request is intentionally stale.',
        ])->assertConflict();

        $this->assertDatabaseCount('seller_compliance_actions', 0);
    }

    public function test_permission_seeder_includes_seller_compliance_permission(): void
    {
        $this->seed(AdminPermissionSeeder::class);
        $this->assertDatabaseHas('permissions', ['slug' => 'seller_compliance.manage']);
    }

    private function admin(string ...$permissions): User
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        foreach ($permissions as $slug) {
            $permission = Permission::query()->firstOrCreate(['slug' => $slug], ['name' => Str::headline($slug), 'description' => 'Test permission.']);
            AdminPermission::create(['admin_id' => $admin->id, 'permission_id' => $permission->id]);
        }

        return $admin;
    }

    private function seller(): User
    {
        return User::query()->where('role', UserRole::Seller)->with('shop')->firstOrFail();
    }

    private function product(): Product
    {
        return Product::query()->where('slug', 'studio-wireless-headphones')->firstOrFail();
    }

    private function createCase(User $admin, User $seller, ?Product $product = null): SellerComplianceCase
    {
        $id = $this->actingAs($admin)->postJson('/api/v1/admin/seller-compliance/cases', [
            'seller_id' => $seller->id,
            'product_id' => $product?->id,
            'reason' => 'Manual compliance review opened by Admin.',
        ])->assertCreated()->json('data.id');

        return SellerComplianceCase::query()->findOrFail($id);
    }
}
