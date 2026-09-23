<?php

namespace App\Services\Seller;

use App\Enums\Seller\ReviewResponseStatus;
use App\Exceptions\Seller\ProductReviewException;
use App\Jobs\Reviews\DeliverProductReviewNotification;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\ProductReviewImage;
use App\Models\SellerReviewResponse;
use App\Models\Shop;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class ProductReviewService
{
    public function __construct(private readonly SellerShopService $shops) {}

    /** @param array{status?: string, product?: string, rating?: int} $filters */
    public function list(User $seller, array $filters, int $perPage): LengthAwarePaginator
    {
        $shop = $this->shops->for($seller);
        $status = $filters['status'] ?? 'all';

        return $this->ownedReviews($shop)
            ->when($status === 'unanswered', fn ($query) => $query->whereDoesntHave('sellerResponse'))
            ->when($status === 'answered', fn ($query) => $query->whereHas('sellerResponse'))
            ->when($filters['product'] ?? null, fn ($query, $product) => $query->where('product_id', $product))
            ->when($filters['rating'] ?? null, fn ($query, $rating) => $query->where('rating', $rating))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    /** @return list<array{id: string, name: string}> */
    public function productOptions(User $seller): array
    {
        $shop = $this->shops->for($seller);

        return Product::query()
            ->withTrashed()
            ->where('shop_id', $shop->id)
            ->whereHas('reviews', fn ($query) => $query->published())
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (Product $product): array => ['id' => $product->id, 'name' => $product->name])
            ->all();
    }

    public function find(User $seller, string $reviewId, bool $lock = false): ProductReview
    {
        $shop = $this->shops->for($seller);
        $query = $this->ownedReviews($shop)->whereKey($reviewId);
        if ($lock) {
            $query->lockForUpdate();
        }

        $review = $query->first();
        if ($review === null) {
            throw ProductReviewException::notFound();
        }

        return $review;
    }

    public function image(User $seller, string $reviewId, string $imageId): ProductReviewImage
    {
        $review = $this->find($seller, $reviewId);
        $image = $review->images->first(
            fn (ProductReviewImage $candidate): bool => $candidate->id === $imageId && $candidate->status === 'approved',
        );

        if ($image === null) {
            throw ProductReviewException::notFound('This Product review photo is not available.');
        }

        return $image;
    }

    /** @return array{review: ProductReview, created: bool} */
    public function respond(User $seller, string $reviewId, string $body, string $idempotencyKey): array
    {
        $shop = $this->shops->for($seller);
        $created = false;
        $requestHash = hash('sha256', json_encode([
            'action' => 'respond',
            'review_id' => $reviewId,
            'response' => $body,
        ], JSON_THROW_ON_ERROR));

        try {
            $responseId = DB::transaction(function () use ($seller, $shop, $reviewId, $body, $idempotencyKey, $requestHash, &$created): string {
                $replay = SellerReviewResponse::query()
                    ->where('seller_id', $seller->id)
                    ->where('idempotency_key', $idempotencyKey)
                    ->lockForUpdate()
                    ->first();
                if ($replay !== null) {
                    $this->assertSameRequest($replay, $requestHash);

                    return $replay->id;
                }

                $review = $this->ownedReviews($shop)
                    ->whereKey($reviewId)
                    ->lockForUpdate()
                    ->first();
                if ($review === null) {
                    throw ProductReviewException::notFound();
                }

                $existing = SellerReviewResponse::query()
                    ->where('review_id', $review->id)
                    ->lockForUpdate()
                    ->first();
                if ($existing !== null) {
                    throw ProductReviewException::conflict(
                        'SELLER_REVIEW_ALREADY_RESPONDED',
                        'This Product review already has an official Shop response.',
                    );
                }

                $response = SellerReviewResponse::query()->create([
                    'review_id' => $review->id,
                    'seller_id' => $seller->id,
                    'shop_id' => $shop->id,
                    'shop_name_snapshot' => $shop->name,
                    'body' => $body,
                    'status' => ReviewResponseStatus::Published,
                    'idempotency_key' => $idempotencyKey,
                    'request_hash' => $requestHash,
                    'published_at' => now(),
                ]);
                $created = true;

                DB::afterCommit(fn () => $this->dispatchNotification($review->id, 'response_published'));

                return $response->id;
            }, 3);
        } catch (QueryException $exception) {
            if (! $this->isUniqueViolation($exception)) {
                throw $exception;
            }

            $response = SellerReviewResponse::query()
                ->where('shop_id', $shop->id)
                ->where(function ($query) use ($reviewId, $seller, $idempotencyKey): void {
                    $query->where('review_id', $reviewId)
                        ->orWhere(fn ($idempotency) => $idempotency
                            ->where('seller_id', $seller->id)
                            ->where('idempotency_key', $idempotencyKey));
                })
                ->first();
            if ($response !== null && $response->idempotency_key === $idempotencyKey) {
                $this->assertSameRequest($response, $requestHash);
                $responseId = $response->id;
            } else {
                throw ProductReviewException::conflict(
                    'SELLER_REVIEW_ALREADY_RESPONDED',
                    'This Product review already has an official Shop response.',
                );
            }
        }

        $response = SellerReviewResponse::query()->findOrFail($responseId);
        $review = $this->ownedReviews($shop)->whereKey($response->review_id)->firstOrFail();

        return [
            'review' => $review,
            'created' => $created,
        ];
    }

    public function publishedForShop(Shop $shop, ?CarbonImmutable $asOf = null): Builder
    {
        return ProductReview::query()
            ->published()
            ->when($asOf !== null, fn (Builder $query) => $query->where('published_at', '<=', $asOf))
            ->whereHas('product', fn (Builder $query) => $query->withTrashed()->where('shop_id', $shop->id));
    }

    private function ownedReviews(Shop $shop): Builder
    {
        return $this->publishedForShop($shop)
            ->with([
                'product' => fn ($query) => $query->withTrashed()->select(['id', 'shop_id', 'name', 'status', 'deleted_at']),
                'images' => fn ($query) => $query->where('status', 'approved')->orderBy('position'),
                'sellerResponse',
            ]);
    }

    private function assertSameRequest(SellerReviewResponse $response, string $requestHash): void
    {
        if (! hash_equals($response->request_hash, $requestHash)) {
            throw ProductReviewException::conflict(
                'IDEMPOTENCY_KEY_REUSED',
                'This Idempotency-Key was already used for different Seller response details.',
                'idempotency_key',
            );
        }
    }

    private function isUniqueViolation(QueryException $exception): bool
    {
        return in_array((string) ($exception->errorInfo[0] ?? $exception->getCode()), ['23000', '23505'], true);
    }

    private function dispatchNotification(string $reviewId, string $event): void
    {
        try {
            DeliverProductReviewNotification::dispatch($reviewId, $event);
        } catch (\Throwable $exception) {
            report($exception);
        }
    }
}
