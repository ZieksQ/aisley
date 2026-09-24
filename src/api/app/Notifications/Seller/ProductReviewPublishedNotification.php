<?php

namespace App\Notifications\Seller;

use App\Models\ProductReview;
use Illuminate\Notifications\Notification;

class ProductReviewPublishedNotification extends Notification
{
    public function __construct(private readonly ProductReview $review) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'seller-product-review.published';
    }

    /** @return array<string, mixed> */
    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => 'New Product review',
            'summary' => "A Customer left a {$this->review->rating}-star review for {$this->review->product_name_snapshot}.",
            'resource_type' => 'product_review',
            'resource_id' => $this->review->id,
            'product_id' => $this->review->product_id,
            'destination' => "/reviews/{$this->review->id}",
        ];
    }
}
