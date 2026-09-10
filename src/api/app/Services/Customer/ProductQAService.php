<?php

namespace App\Services\Customer;

use App\Exceptions\Customer\ProductQAException;
use App\Jobs\Customer\DeliverProductQANotification;
use App\Models\Product;
use App\Models\ProductQA;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ProductQAService
{
    public function ask(User $customer, string $productId, string $question, string $idempotencyKey): ProductQA
    {
        $text = $this->normalize($question);
        $requestHash = $this->hash([
            'action' => 'ask',
            'product_id' => $productId,
            'question' => $text,
        ]);

        $questionId = DB::transaction(function () use ($customer, $productId, $text, $idempotencyKey, $requestHash): string {
            $previous = ProductQA::query()
                ->where('customer_id', $customer->id)
                ->where('question_idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous !== null) {
                $this->assertSameRequest($previous->question_request_hash, $requestHash);

                return $previous->id;
            }

            $product = Product::query()
                ->storefrontVisible()
                ->with('shop.seller')
                ->whereKey($productId)
                ->lockForUpdate()
                ->first();
            if ($product === null) {
                throw ProductQAException::notFound('This Product is not currently available.');
            }

            $previous = ProductQA::query()
                ->where('customer_id', $customer->id)
                ->where('question_idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous !== null) {
                $this->assertSameRequest($previous->question_request_hash, $requestHash);

                return $previous->id;
            }

            $question = ProductQA::query()->create([
                'product_id' => $product->id,
                'customer_id' => $customer->id,
                'question_text' => $text,
                'question_idempotency_key' => $idempotencyKey,
                'question_request_hash' => $requestHash,
                'asked_at' => now(),
            ]);

            DB::afterCommit(fn () => $this->dispatchNotification($question->id, 'question_asked'));

            return $question->id;
        }, 3);

        return ProductQA::query()->with('product.shop')->findOrFail($questionId);
    }

    public function answer(User $seller, ProductQA $question, string $answer, string $idempotencyKey): ProductQA
    {
        $text = $this->normalize($answer);
        $requestHash = $this->hash([
            'action' => 'answer',
            'question_id' => $question->id,
            'answer' => $text,
        ]);

        $questionId = DB::transaction(function () use ($seller, $question, $text, $idempotencyKey, $requestHash): string {
            $previous = ProductQA::query()
                ->where('answered_by_seller_id', $seller->id)
                ->where('answer_idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous !== null) {
                $this->assertSameRequest($previous->answer_request_hash, $requestHash);

                return $previous->id;
            }

            $locked = ProductQA::query()
                ->with('product.shop')
                ->whereKey($question->id)
                ->lockForUpdate()
                ->first();
            if ($locked === null) {
                throw ProductQAException::notFound();
            }

            $visible = Product::query()->storefrontVisible()->whereKey($locked->product_id)->exists();
            if (! $visible) {
                throw ProductQAException::notFound('This Product is not currently available for an answer.');
            }

            if ($locked->product?->shop?->seller_id !== $seller->id) {
                throw ProductQAException::forbidden();
            }

            $previous = ProductQA::query()
                ->where('answered_by_seller_id', $seller->id)
                ->where('answer_idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous !== null) {
                $this->assertSameRequest($previous->answer_request_hash, $requestHash);

                return $previous->id;
            }

            if ($locked->answer_text !== null) {
                throw ProductQAException::conflict(
                    'PRODUCT_QA_ALREADY_ANSWERED',
                    'This Product question already has an official answer.',
                );
            }

            $locked->forceFill([
                'answer_text' => $text,
                'answered_by_seller_id' => $seller->id,
                'answer_idempotency_key' => $idempotencyKey,
                'answer_request_hash' => $requestHash,
                'answered_at' => now(),
            ])->save();

            DB::afterCommit(fn () => $this->dispatchNotification($locked->id, 'question_answered'));

            return $locked->id;
        }, 3);

        return ProductQA::query()->with('product.shop')->findOrFail($questionId);
    }

    private function dispatchNotification(string $questionId, string $event): void
    {
        try {
            DeliverProductQANotification::dispatch($questionId, $event);
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function assertSameRequest(string $previousHash, string $requestHash): void
    {
        if (! hash_equals($previousHash, $requestHash)) {
            throw ProductQAException::conflict(
                'IDEMPOTENCY_KEY_REUSED',
                'This Idempotency-Key was already used for different Product Q&A details.',
                'idempotency_key',
            );
        }
    }

    private function normalize(string $text): string
    {
        $text = trim($text);
        if (class_exists(\Normalizer::class)) {
            $normalized = \Normalizer::normalize($text, \Normalizer::FORM_C);
            if (is_string($normalized)) {
                $text = $normalized;
            }
        }

        return preg_replace('/\R/u', "\n", $text) ?? $text;
    }

    /** @param array<string, string> $value */
    private function hash(array $value): string
    {
        return hash('sha256', json_encode($value, JSON_THROW_ON_ERROR));
    }
}
