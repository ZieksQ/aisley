<?php

namespace App\Notifications\Seller;

use Illuminate\Notifications\Notification;

class SellerComplianceNotification extends Notification
{
    public function __construct(
        private readonly string $caseId,
        private readonly string $title,
        private readonly string $summary,
        private readonly ?string $productId = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'seller-compliance.action';
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => $this->title,
            'summary' => $this->summary,
            'resource_type' => 'seller_compliance_case',
            'resource_id' => $this->caseId,
            'product_id' => $this->productId,
            'destination' => $this->productId ? "/products/{$this->productId}" : '/account',
        ];
    }
}
