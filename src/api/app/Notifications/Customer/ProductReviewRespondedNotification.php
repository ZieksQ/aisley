<?php

namespace App\Notifications\Customer;

use App\Models\ProductReview;
use App\Models\SellerReviewResponse;
use Illuminate\Notifications\Notification;

class ProductReviewRespondedNotification extends Notification
{
    public function __construct(
        private readonly ProductReview $review,
        private readonly SellerReviewResponse $response,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'customer-product-review.responded';
    }

    /** @return array<string, mixed> */
    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => 'A Shop responded to your review',
            'summary' => "{$this->response->shop_name_snapshot} responded to your review of {$this->review->product_name_snapshot}.",
            'resource_type' => 'product_review',
            'resource_id' => $this->review->id,
            'product_id' => $this->review->product_id,
            'destination' => "/products/{$this->review->product_id}#product-reviews",
        ];
    }
}
