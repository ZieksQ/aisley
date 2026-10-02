<?php

namespace App\Services\Admin;

use App\Enums\SellerComplianceCaseStatus;
use App\Enums\SupportTicketStatus;
use App\Models\SellerComplianceCase;
use App\Models\User;
use App\Services\Support\SupportTicketReader;

class DashboardQueueCounts
{
    public function __construct(private readonly SupportTicketReader $tickets) {}

    public function openSupportTickets(User $admin): int
    {
        return $this->tickets->scoped($admin)->where('status', SupportTicketStatus::Open)->count();
    }

    public function openComplianceCases(): int
    {
        // Same global Admin scope and status filter as SellerComplianceController::index.
        return SellerComplianceCase::query()->where('status', SellerComplianceCaseStatus::Open)->count();
    }
}
