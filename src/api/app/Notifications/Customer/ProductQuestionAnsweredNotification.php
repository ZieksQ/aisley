<?php

namespace App\Notifications\Customer;

use App\Models\ProductQA;
use Illuminate\Notifications\Notification;

class ProductQuestionAnsweredNotification extends Notification
{
    public function __construct(private readonly ProductQA $question) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'customer-product-qa.answered';
    }

    /** @return array<string, mixed> */
    public function toDatabase(object $notifiable): array
    {
        $this->question->loadMissing('product:id,name');

        return [
            'title' => 'Your Product question was answered',
            'summary' => "The seller answered your question about {$this->question->product->name}.",
            'resource_type' => 'product_question',
            'resource_id' => $this->question->id,
            'product_id' => $this->question->product_id,
            'destination' => "/products/{$this->question->product_id}#product-qa",
        ];
    }
}
