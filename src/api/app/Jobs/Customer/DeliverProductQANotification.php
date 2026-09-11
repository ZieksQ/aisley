<?php

namespace App\Jobs\Customer;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\ProductQA;
use App\Notifications\Customer\ProductQuestionAnsweredNotification;
use App\Notifications\Seller\ProductQuestionAskedNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Ramsey\Uuid\Uuid;

class DeliverProductQANotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public readonly string $questionId,
        public readonly string $event,
    ) {}

    public function handle(): void
    {
        $question = ProductQA::query()->with(['product:id,name,shop_id', 'product.shop:id,seller_id'])->find($this->questionId);
        if ($question === null) {
            return;
        }

        if ($this->event === 'question_asked') {
            $recipient = $question->product?->shop?->seller;
            if ($recipient === null || $recipient->role !== UserRole::Seller || $recipient->status !== UserStatus::Active) {
                return;
            }
            $notificationId = Uuid::uuid5(
                Uuid::NAMESPACE_URL,
                "aisley:seller:{$recipient->id}:product-question:{$question->id}",
            )->toString();
            if ($recipient->notifications()->whereKey($notificationId)->exists()) {
                return;
            }
            $notification = new ProductQuestionAskedNotification($question);
            $notification->id = $notificationId;
            $recipient->notify($notification);

            return;
        }

        if ($this->event === 'question_answered') {
            $recipient = $question->customer;
            if ($recipient === null || $recipient->role !== UserRole::Customer || $recipient->status !== UserStatus::Active) {
                return;
            }
            $notificationId = Uuid::uuid5(
                Uuid::NAMESPACE_URL,
                "aisley:customer:{$recipient->id}:product-question-answer:{$question->id}",
            )->toString();
            if ($recipient->notifications()->whereKey($notificationId)->exists()) {
                return;
            }
            $notification = new ProductQuestionAnsweredNotification($question);
            $notification->id = $notificationId;
            $recipient->notify($notification);
        }
    }
}
