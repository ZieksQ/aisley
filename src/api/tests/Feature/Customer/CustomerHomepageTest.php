<?php

namespace Tests\Feature\Customer;

use App\Enums\AddressType;
use App\Enums\CategoryStatus;
use App\Enums\HomepageCampaignPlacement;
use App\Enums\ProductStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\Category;
use App\Models\CustomerProfile;
use App\Models\FlashDeal;
use App\Models\HomepageCampaign;
use App\Models\Product;
use App\Models\RecentlyViewedProduct;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerHomepageTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
    }

    public function test_guest_homepage_returns_only_current_and_storefront_eligible_content(): void
    {
        $category = $this->createCategory(['name' => 'Electronics', 'slug' => 'electronics']);
        $this->createCategory([
            'name' => 'Archived',
            'slug' => 'archived',
            'status' => CategoryStatus::Archived,
        ]);

        $shop = $this->createShop();
        $eligible = $this->createProduct($shop, $category, [
            'name' => 'Wireless Earbuds',
            'slug' => 'wireless-earbuds',
            'price' => 100,
            'original_price' => 125,
            'average_rating' => 4.75,
            'review_count' => 8,
            'sold_count' => 42,
            'badges' => ['free_shipping'],
        ]);
        $outOfStock = $this->createProduct($shop, $category, [
            'slug' => 'out-of-stock',
            'stock_quantity' => 0,
            'sold_count' => 100,
        ]);
        $draft = $this->createProduct($shop, $category, [
            'slug' => 'draft-product',
            'status' => ProductStatus::Draft,
        ]);
        $unapprovedShop = $this->createShop([
            'seller_status' => UserStatus::Pending,
            'name' => 'Pending Seller Shop',
            'slug' => 'pending-seller-shop',
        ]);
        $unapprovedProduct = $this->createProduct($unapprovedShop, $category, [
            'slug' => 'pending-seller-product',
        ]);

        $campaign = HomepageCampaign::create([
            'placement' => HomepageCampaignPlacement::Hero,
            'title' => 'Payday Sale',
            'image_desktop_path' => 'campaigns/payday-desktop.webp',
            'image_mobile_path' => 'campaigns/payday-mobile.webp',
            'alt_text' => 'Payday Sale up to 40% off',
            'destination_url' => '/campaigns/payday',
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addHour(),
            'priority' => 100,
            'is_active' => true,
        ]);
        HomepageCampaign::create([
            'placement' => HomepageCampaignPlacement::Hero,
            'title' => 'Expired Campaign',
            'image_desktop_path' => 'campaigns/expired-desktop.webp',
            'image_mobile_path' => 'campaigns/expired-mobile.webp',
            'alt_text' => 'Expired Campaign',
            'destination_url' => '/campaigns/expired',
            'starts_at' => now()->subDays(2),
            'ends_at' => now()->subDay(),
            'priority' => 200,
            'is_active' => true,
        ]);
        HomepageCampaign::create([
            'placement' => HomepageCampaignPlacement::HeroSide,
            'title' => 'Unsafe Destination',
            'image_desktop_path' => 'campaigns/side.webp',
            'image_mobile_path' => 'campaigns/side-mobile.webp',
            'alt_text' => 'Side promotion',
            'destination_url' => 'https://malicious.example/phishing',
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addHour(),
            'priority' => 10,
            'is_active' => true,
        ]);

        $deal = FlashDeal::create([
            'name' => 'Lunch Break Deals',
            'starts_at' => now()->subMinutes(30),
            'ends_at' => now()->addMinutes(30),
            'is_active' => true,
        ]);
        $deal->products()->attach($eligible->id, [
            'deal_price' => 80,
            'deal_stock' => 10,
            'sold_quantity' => 3,
        ]);
        $deal->products()->attach($outOfStock->id, [
            'deal_price' => 70,
            'deal_stock' => 10,
            'sold_quantity' => 0,
        ]);

        $response = $this->getJson('/api/v1/customer/home')->assertOk();

        $response
            ->assertHeader('Cache-Control', 'max-age=60, public')
            ->assertJsonPath('viewer.isAuthenticated', false)
            ->assertJsonPath('viewer.email', null)
            ->assertJsonPath('viewer.deliveryLocation', null)
            ->assertJsonPath('campaigns.hero.0.id', $campaign->id)
            ->assertJsonCount(1, 'campaigns.hero')
            ->assertJsonPath('campaigns.side.0.destinationUrl', 'https://malicious.example/phishing')
            ->assertJsonCount(1, 'categories')
            ->assertJsonPath('categories.0.slug', 'electronics')
            ->assertJsonPath('flashDeals.id', $deal->id)
            ->assertJsonCount(1, 'flashDeals.products')
            ->assertJsonPath('flashDeals.products.0.id', $eligible->id)
            ->assertJsonPath('flashDeals.products.0.price', 80)
            ->assertJsonPath('flashDeals.products.0.originalPrice', 100)
            ->assertJsonPath('flashDeals.products.0.discountPercent', 20)
            ->assertJsonPath('flashDeals.products.0.deal.soldCount', 3)
            ->assertJsonPath('flashDeals.products.0.deal.remainingStock', 7)
            ->assertJsonPath('flashDeals.products.0.deal.progressPercent', 30)
            ->assertJsonPath('topProducts.0.id', $eligible->id)
            ->assertJsonPath('recentlyViewed', [])
            ->assertJsonPath('recommendations.items.0.id', $eligible->id)
            ->assertJsonPath('recommendations.nextCursor', null)
            ->assertJsonMissing(['id' => $draft->id])
            ->assertJsonMissing(['id' => $unapprovedProduct->id]);
    }

    public function test_active_customer_receives_delivery_recent_history_and_category_aware_discovery(): void
    {
        $customer = $this->createCustomer();
        $customer->addresses()->create([
            'type' => AddressType::Shipping,
            'label' => 'Home',
            'recipient_name' => 'Aisley Buyer',
            'contact_number' => '+639171234567',
            'address_line_1' => '123 Test Street',
            'barangay' => 'San Antonio',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'NCR',
            'postal_code' => '1203',
            'is_default' => true,
        ]);

        $preferredCategory = $this->createCategory(['name' => 'Beauty', 'slug' => 'beauty']);
        $otherCategory = $this->createCategory(['name' => 'Home', 'slug' => 'home']);
        $shop = $this->createShop();
        $otherShop = $this->createShop(['name' => 'Second Shop', 'slug' => 'second-shop']);
        $preferred = $this->createProduct($shop, $preferredCategory, [
            'slug' => 'preferred-product',
            'sold_count' => 1,
        ]);
        $popular = $this->createProduct($otherShop, $otherCategory, [
            'slug' => 'popular-product',
            'sold_count' => 500,
        ]);
        $unavailableRecent = $this->createProduct($shop, $preferredCategory, [
            'slug' => 'unavailable-recent',
            'stock_quantity' => 0,
        ]);

        RecentlyViewedProduct::create([
            'user_id' => $customer->id,
            'product_id' => $preferred->id,
            'last_viewed_at' => now()->subHour(),
        ]);
        RecentlyViewedProduct::create([
            'user_id' => $customer->id,
            'product_id' => $unavailableRecent->id,
            'last_viewed_at' => now(),
        ]);

        $this->actingAs($customer, 'web');

        $response = $this->getJson('/api/v1/customer/home')->assertOk();

        $response
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('viewer.isAuthenticated', true)
            ->assertJsonPath('viewer.displayName', 'Aisley')
            ->assertJsonPath('viewer.email', $customer->email)
            ->assertJsonPath('viewer.deliveryLocation.label', 'Home')
            ->assertJsonPath('viewer.deliveryLocation.cityMunicipality', 'Makati City')
            ->assertJsonPath('viewer.deliveryLocation.province', 'Metro Manila')
            ->assertJsonCount(2, 'recentlyViewed')
            ->assertJsonPath('recentlyViewed.0.id', $unavailableRecent->id)
            ->assertJsonPath('recentlyViewed.0.stockStatus', 'out_of_stock')
            ->assertJsonPath('recommendations.items.0.id', $preferred->id);

        $this->assertSame($popular->id, $response->json('topProducts.0.id'));
    }

    public function test_non_customer_or_inactive_identity_is_not_used_for_personalization(): void
    {
        $seller = User::factory()->create([
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);

        Sanctum::actingAs($seller);

        $this->getJson('/api/v1/customer/home')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('viewer.isAuthenticated', false)
            ->assertJsonPath('recentlyViewed', []);

        $pendingCustomer = $this->createCustomer(['status' => UserStatus::Pending]);
        Sanctum::actingAs($pendingCustomer);

        $this->getJson('/api/v1/customer/home')
            ->assertOk()
            ->assertJsonPath('viewer.isAuthenticated', false)
            ->assertJsonPath('recentlyViewed', []);
    }

    public function test_discovery_uses_a_bounded_cursor_without_repeating_products(): void
    {
        $category = $this->createCategory();
        $firstShop = $this->createShop();
        $secondShop = $this->createShop(['name' => 'Second Shop', 'slug' => 'second-shop']);

        foreach (range(1, 10) as $position) {
            $this->createProduct($position % 2 === 0 ? $firstShop : $secondShop, $category, [
                'name' => "Product {$position}",
                'slug' => "product-{$position}",
                'sold_count' => 100 - $position,
            ]);
        }

        $firstPage = $this->getJson('/api/v1/customer/home/recommendations?limit=8')
            ->assertOk()
            ->assertJsonCount(8, 'recommendations.items')
            ->assertJsonPath('recommendations.pageSize', 8);

        $cursor = $firstPage->json('recommendations.nextCursor');
        $this->assertIsString($cursor);

        $secondPage = $this->getJson('/api/v1/customer/home/recommendations?limit=8&cursor='.urlencode($cursor))
            ->assertOk()
            ->assertJsonCount(2, 'recommendations.items')
            ->assertJsonPath('recommendations.nextCursor', null);

        $firstIds = collect($firstPage->json('recommendations.items'))->pluck('id');
        $secondIds = collect($secondPage->json('recommendations.items'))->pluck('id');

        $this->assertCount(10, $firstIds->concat($secondIds)->unique());

        $this->getJson('/api/v1/customer/home/recommendations?limit=7')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('limit');
        $this->getJson('/api/v1/customer/home/recommendations?limit=51')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('limit');
        $this->getJson('/api/v1/customer/home/recommendations?cursor=not-a-cursor')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cursor');
        $malformedCursor = rtrim(strtr(base64_encode(json_encode([
            '_pointsToNextItems' => true,
        ])), '+/', '-_'), '=');
        $this->getJson('/api/v1/customer/home/recommendations?cursor='.$malformedCursor)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cursor');
    }

    public function test_product_search_trims_queries_matches_products_shops_and_categories_and_hides_ineligible_records(): void
    {
        $electronics = $this->createCategory(['name' => 'Electronics', 'slug' => 'electronics']);
        $home = $this->createCategory(['name' => 'Home', 'slug' => 'home']);
        $techShop = $this->createShop(['name' => 'Tech Haven', 'slug' => 'tech-haven']);
        $otherShop = $this->createShop(['name' => 'Other Shop', 'slug' => 'other-shop']);
        $titleMatch = $this->createProduct($otherShop, $home, [
            'name' => 'Wireless Earbuds',
            'slug' => 'wireless-earbuds',
            'stock_quantity' => 0,
        ]);
        $shopMatch = $this->createProduct($techShop, $home, [
            'name' => 'Desk Lamp',
            'slug' => 'desk-lamp',
        ]);
        $categoryMatch = $this->createProduct($otherShop, $electronics, [
            'name' => 'Pocket Radio',
            'slug' => 'pocket-radio',
        ]);
        $inactiveShop = $this->createShop([
            'name' => 'Inactive Tech',
            'slug' => 'inactive-tech',
            'status' => ShopStatus::Suspended,
        ]);
        $hidden = $this->createProduct($inactiveShop, $home, [
            'name' => 'Tech Hidden',
            'slug' => 'tech-hidden',
        ]);

        $titleResponse = $this->getJson('/api/v1/customer/products/search?q=%20wireless%20')
            ->assertOk()
            ->assertJsonPath('query', 'wireless')
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.id', $titleMatch->id)
            ->assertJsonPath('items.0.stockStatus', 'out_of_stock')
            ->assertJsonMissingPath('items.0.short_description');

        $this->assertSame(1, $titleResponse->json('pagination.total'));

        $techResponse = $this->getJson('/api/v1/customer/products/search?q=tech')
            ->assertOk();
        $techIds = collect($techResponse->json('items'))->pluck('id');
        $this->assertTrue($techIds->contains($shopMatch->id));
        $this->assertFalse($techIds->contains($hidden->id));

        $categoryResponse = $this->getJson('/api/v1/customer/products/search?q=electronics')
            ->assertOk();
        $this->assertContains($categoryMatch->id, collect($categoryResponse->json('items'))->pluck('id'));

        $this->getJson('/api/v1/customer/products/search?q=%20%20%20')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('q');
        $this->getJson('/api/v1/customer/products/search?q=%25')
            ->assertOk()
            ->assertJsonCount(0, 'items');
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createCustomer(array $overrides = []): User
    {
        $customer = User::factory()->create(array_merge([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ], $overrides));

        CustomerProfile::create([
            'user_id' => $customer->id,
            'first_name' => 'Aisley',
            'last_name' => 'Buyer',
            'contact_number' => '+639171234567',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '2000-01-01',
        ]);

        return $customer;
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createCategory(array $overrides = []): Category
    {
        return Category::create(array_merge([
            'name' => 'Marketplace',
            'slug' => 'marketplace-'.Str::lower(Str::random(8)),
            'status' => CategoryStatus::Active,
            'image_path' => 'categories/default.webp',
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createShop(array $overrides = []): Shop
    {
        $seller = User::factory()->create([
            'role' => UserRole::Seller,
            'status' => $overrides['seller_status'] ?? UserStatus::Active,
        ]);

        unset($overrides['seller_status']);

        return Shop::create(array_merge([
            'seller_id' => $seller->id,
            'name' => 'Aisley Test Shop',
            'slug' => 'shop-'.Str::lower(Str::random(8)),
            'status' => ShopStatus::Active,
            'is_on_vacation' => false,
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createProduct(Shop $shop, Category $category, array $overrides = []): Product
    {
        return Product::create(array_merge([
            'shop_id' => $shop->id,
            'category_id' => $category->id,
            'name' => 'Marketplace Product',
            'slug' => 'product-'.Str::lower(Str::random(8)),
            'thumbnail_path' => 'products/default.webp',
            'price' => 100,
            'original_price' => null,
            'stock_quantity' => 20,
            'average_rating' => null,
            'review_count' => 0,
            'sold_count' => 0,
            'badges' => [],
            'is_promoted' => false,
            'status' => ProductStatus::Active,
            'published_at' => now()->subDay(),
        ], $overrides));
    }
}
