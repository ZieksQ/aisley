<?php

namespace Tests\Feature\Seller;

use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Product;
use App\Models\ProductQA;
use App\Models\User;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProductQATest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_list_and_open_shop_scoped_questions_with_filters(): void
    {
        $product = $this->product();
        $seller = $product->shop->seller;
        $customer = $this->customer();
        $unanswered = ProductQA::query()->create($this->questionAttributes($product, $customer, 'Does this come in black?'));
        $answered = ProductQA::query()->create([
            ...$this->questionAttributes($product, $customer, 'Is the cable included?'),
            'answer_text' => 'Yes, the cable is included.',
            'answered_by_seller_id' => $seller->id,
            'answer_idempotency_key' => (string) Str::uuid(),
            'answer_request_hash' => hash('sha256', 'Yes, the cable is included.'),
            'answered_at' => now(),
        ]);

        $this->actingAs($seller)
            ->getJson('/api/v1/seller/product-questions?status=unanswered&product='.urlencode($product->name))
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $unanswered->id)
            ->assertJsonPath('data.0.state', 'unanswered')
            ->assertJsonPath('data.0.product.id', $product->id)
            ->assertJsonMissingPath('data.0.customer_id');

        $this->actingAs($seller)
            ->getJson("/api/v1/seller/product-questions/{$answered->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $answered->id)
            ->assertJsonPath('data.state', 'answered')
            ->assertJsonPath('data.answer', 'Yes, the cable is included.')
            ->assertJsonPath('data.product.status', 'active')
            ->assertJsonMissingPath('data.customer_id');
    }

    public function test_queue_keeps_historical_questions_visible_but_foreign_sellers_cannot_read_them(): void
    {
        $product = $this->product();
        $question = ProductQA::query()->create($this->questionAttributes($product, $this->customer(), 'Can I still order this?'));
        $product->update(['status' => ProductStatus::Archived]);

        $this->actingAs($product->shop->seller)
            ->getJson('/api/v1/seller/product-questions')
            ->assertOk()
            ->assertJsonPath('data.0.id', $question->id)
            ->assertJsonPath('data.0.product.status', 'archived');

        $this->actingAs(User::factory()->create([
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]))->getJson("/api/v1/seller/product-questions/{$question->id}")
            ->assertNotFound();
    }

    public function test_queue_rejects_unknown_filters_and_requires_seller_access(): void
    {
        $this->getJson('/api/v1/seller/product-questions')->assertUnauthorized();

        $this->actingAs($this->product()->shop->seller)
            ->getJson('/api/v1/seller/product-questions?state=unanswered')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['state']);
    }

    private function product(): Product
    {
        $this->seed(ProductSeeder::class);

        return Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();
    }

    private function customer(): User
    {
        return User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
    }

    /** @return array<string, mixed> */
    private function questionAttributes(Product $product, User $customer, string $text): array
    {
        return [
            'product_id' => $product->id,
            'customer_id' => $customer->id,
            'question_text' => $text,
            'question_idempotency_key' => (string) Str::uuid(),
            'question_request_hash' => hash('sha256', $text),
            'asked_at' => now(),
        ];
    }
}
