<?php

namespace App\Jobs\Reviews;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\ProductReview;
use App\Notifications\Customer\ProductReviewRespondedNotification;
use App\Notifications\Seller\ProductReviewPublishedNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Ramsey\Uuid\Uuid;

class DeliverProductReviewNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public readonly string $reviewId,
        public readonly string $event,
    ) {}

    public function handle(): void
    {
        $review = ProductReview::query()
            ->with([
                'customer',
                'product' => fn ($query) => $query->withTrashed()->with('shop.seller'),
                'sellerResponse',
            ])
            ->find($this->reviewId);
        if ($review === null) {
            return;
        }

        if ($this->event === 'review_published') {
            $recipient = $review->product?->shop?->seller;
            if ($recipient === null || $recipient->role !== UserRole::Seller || $recipient->status !== UserStatus::Active) {
                return;
            }
            $notificationId = Uuid::uuid5(
                Uuid::NAMESPACE_URL,
                "aisley:seller:{$recipient->id}:product-review:{$review->id}",
            )->toString();
            if ($recipient->notifications()->whereKey($notificationId)->exists()) {
                return;
            }
            $notification = new ProductReviewPublishedNotification($review);
            $notification->id = $notificationId;
            $recipient->notify($notification);

            return;
        }

        if ($this->event === 'response_published') {
            $recipient = $review->customer;
            $response = $review->sellerResponse;
            if ($recipient === null || $response === null
                || $recipient->role !== UserRole::Customer || $recipient->status !== UserStatus::Active) {
                return;
            }
            $notificationId = Uuid::uuid5(
                Uuid::NAMESPACE_URL,
                "aisley:customer:{$recipient->id}:product-review-response:{$response->id}",
            )->toString();
            if ($recipient->notifications()->whereKey($notificationId)->exists()) {
                return;
            }
            $notification = new ProductReviewRespondedNotification($review, $response);
            $notification->id = $notificationId;
            $recipient->notify($notification);
        }
    }
}
