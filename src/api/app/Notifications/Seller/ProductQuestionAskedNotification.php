<?php

namespace App\Notifications\Seller;

use App\Models\ProductQA;
use Illuminate\Notifications\Notification;

class ProductQuestionAskedNotification extends Notification
{
    public function __construct(private readonly ProductQA $question) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'seller-product-qa.question-asked';
    }

    /** @return array<string, mixed> */
    public function toDatabase(object $notifiable): array
    {
        $this->question->loadMissing('product:id,name');
        $preview = mb_substr($this->question->question_text, 0, 160);

        return [
            'title' => 'New Product question',
            'summary' => "A Customer asked about {$this->question->product->name}: {$preview}",
            'resource_type' => 'product_question',
            'resource_id' => $this->question->id,
            'product_id' => $this->question->product_id,
            'destination' => "/products/{$this->question->product_id}/questions/{$this->question->id}",
        ];
    }
}
