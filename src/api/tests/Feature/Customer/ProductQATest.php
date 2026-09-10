<?php

namespace Tests\Feature\Customer;

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

    public function test_guests_can_read_a_bounded_public_projection_for_a_visible_product(): void
    {
        $product = $this->product();
        $customer = $this->customer();
        $question = ProductQA::query()->create($this->questionAttributes($product, $customer, 'Is this available in black?'));

        $this->getJson("/api/v1/products/{$product->id}/questions?limit=50")
            ->assertOk()
            ->assertJsonPath('data.0.id', $question->id)
            ->assertJsonPath('data.0.question', 'Is this available in black?')
            ->assertJsonPath('data.0.answer', null)
            ->assertJsonMissingPath('data.0.customer_id')
            ->assertJsonMissingPath('data.0.question_idempotency_key')
            ->assertJsonPath('meta.per_page', 50);

        $product->update(['status' => ProductStatus::Draft]);
        $this->getJson("/api/v1/products/{$product->id}/questions")->assertNotFound();
    }

    public function test_only_an_active_customer_can_ask_and_retry_is_idempotent(): void
    {
        $product = $this->product();
        $customer = $this->customer();
        $key = (string) Str::uuid();

        $first = $this->actingAs($customer)
            ->withHeader('Idempotency-Key', $key)
            ->postJson("/api/v1/products/{$product->id}/questions", ['question' => "  Does it fit?\r\n"])
            ->assertCreated()
            ->assertJsonPath('data.question', 'Does it fit?');

        $this->actingAs($customer)
            ->withHeader('Idempotency-Key', $key)
            ->postJson("/api/v1/products/{$product->id}/questions", ['question' => 'Does it fit?'])
            ->assertCreated()
            ->assertJsonPath('data.id', $first->json('data.id'));

        $this->assertDatabaseCount('product_qas', 1);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $product->shop->seller_id,
            'type' => 'seller-product-qa.question-asked',
        ]);

        $this->actingAs($customer)
            ->withHeader('Idempotency-Key', $key)
            ->postJson("/api/v1/products/{$product->id}/questions", ['question' => 'A different question'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');

    }

    public function test_guests_cannot_ask_a_product_question(): void
    {
        $product = $this->product();

        $this->postJson("/api/v1/products/{$product->id}/questions", ['question' => 'Guest question'])
            ->assertUnauthorized();
    }

    public function test_question_validation_rejects_unknown_markup_and_missing_idempotency_key(): void
    {
        $product = $this->product();
        $customer = $this->customer();

        $this->actingAs($customer)
            ->postJson("/api/v1/products/{$product->id}/questions", [
                'question' => '<script>alert(1)</script>',
                'customer_id' => $customer->id,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['question', 'customer_id', 'idempotency_key']);
    }

    public function test_only_the_owning_seller_can_publish_one_answer_and_answer_retries_are_idempotent(): void
    {
        $product = $this->product();
        $customer = $this->customer();
        $seller = $product->shop->seller;
        $question = $this->actingAs($customer)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/v1/products/{$product->id}/questions", ['question' => 'What is included?'])
            ->assertCreated()
            ->json('data');

        $answerKey = (string) Str::uuid();
        $this->actingAs($seller)
            ->withHeader('Idempotency-Key', $answerKey)
            ->postJson("/api/v1/seller/product-questions/{$question['id']}/answer", ['answer' => 'A charging cable is included.'])
            ->assertOk()
            ->assertJsonPath('data.answer', 'A charging cable is included.')
            ->assertJsonPath('data.sellerLabel', $product->shop->name);

        $this->actingAs($seller)
            ->withHeader('Idempotency-Key', $answerKey)
            ->postJson("/api/v1/seller/product-questions/{$question['id']}/answer", ['answer' => 'A charging cable is included.'])
            ->assertOk()
            ->assertJsonPath('data.id', $question['id']);

        $this->assertDatabaseCount('notifications', 2);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $customer->id,
            'type' => 'customer-product-qa.answered',
        ]);

        $otherSeller = User::factory()->create([
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($otherSeller)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/v1/seller/product-questions/{$question['id']}/answer", ['answer' => 'Not yours.'])
            ->assertForbidden();

        $this->actingAs($seller)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/v1/seller/product-questions/{$question['id']}/answer", ['answer' => 'A second answer.'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'PRODUCT_QA_ALREADY_ANSWERED');

        $this->getJson("/api/v1/products/{$product->id}/questions")
            ->assertOk()
            ->assertJsonPath('data.0.answer', 'A charging cable is included.')
            ->assertJsonPath('data.0.sellerLabel', $product->shop->name);
    }

    public function test_answering_or_reading_a_hidden_product_does_not_leak_questions(): void
    {
        $product = $this->product();
        $customer = $this->customer();
        $seller = $product->shop->seller;
        $question = ProductQA::query()->create($this->questionAttributes($product, $customer, 'Can I order this?'));
        $product->update(['status' => ProductStatus::Archived]);

        $this->actingAs($seller)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/v1/seller/product-questions/{$question->id}/answer", ['answer' => 'No longer listed.'])
            ->assertNotFound();
        $this->getJson("/api/v1/products/{$product->id}/questions")->assertNotFound();
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
        $key = (string) Str::uuid();

        return [
            'product_id' => $product->id,
            'customer_id' => $customer->id,
            'question_text' => $text,
            'question_idempotency_key' => $key,
            'question_request_hash' => hash('sha256', $text),
            'asked_at' => now(),
        ];
    }
}
