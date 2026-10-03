<?php

namespace App\Services\Admin;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Models\RegistrationApplication;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    private const REGISTRATION_ACTION_LIMIT = 5;

    public function __construct(private readonly DashboardQueueCounts $counts) {}

    public function overview(User $admin): array
    {
        $permissions = $admin->permissions()->pluck('slug');

        return [
            'registrations' => $permissions->contains('registrations.view') ? $this->registrationOverview() : null,
            'support_tickets' => $permissions->contains('support-tickets.view')
                ? $this->queueSummary(fn () => $this->counts->openSupportTickets($admin), '/support-tickets?status=open') : null,
            'seller_compliance' => $permissions->contains('seller_compliance.manage')
                ? $this->queueSummary(fn () => $this->counts->openComplianceCases(), '/seller-compliance?status=open') : null,
            'generated_at' => now()->toIso8601String(),
        ];
    }

    private function queueSummary(callable $count, string $destination): array
    {
        $summary = ['state' => 'ready', 'count' => null, 'filter' => ['status' => 'open'], 'destination' => $destination];
        try {
            // A local SQL error must roll back its savepoint before other sections query PostgreSQL.
            $summary['count'] = DB::transaction($count, 1);
        } catch (QueryException $exception) {
            $state = $exception->errorInfo[0] ?? '';
            $localSchemaFailure = in_array($state, ['42P01', '42703', '42S02', '42S22'], true)
                || ($state === 'HY000' && preg_match('/no such (table|column):/i', $exception->getMessage()));
            // Connection, database-permission, and unexpected query failures fail closed.
            if (! $localSchemaFailure) {
                throw $exception;
            }
            report($exception);
            $summary['state'] = 'unavailable';
        }

        return $summary;
    }

    /** @return array<string, mixed> */
    private function registrationOverview(): array
    {
        $pending = $this->pendingRegistrations();

        $counts = (clone $pending)
            ->selectRaw('application_type, COUNT(*) AS aggregate')
            ->groupBy('application_type')
            ->pluck('aggregate', 'application_type');

        $customerCount = (int) $counts->get(UserRole::Customer->value, 0);
        $sellerCount = (int) $counts->get(UserRole::Seller->value, 0);
        $logisticsCount = (int) $counts->get(UserRole::Logistics->value, 0);

        $actionItems = (clone $pending)
            ->oldest('submitted_at')
            ->oldest('id')
            ->limit(self::REGISTRATION_ACTION_LIMIT)
            ->get(['id', 'application_type', 'submitted_at'])
            ->map(fn (RegistrationApplication $application): array => [
                'id' => $application->id,
                'role' => $application->application_type->value,
                'submitted_at' => $application->submitted_at->toIso8601String(),
            ])
            ->values();

        return [
            'pending' => [
                'total' => $customerCount + $sellerCount + $logisticsCount,
                'by_role' => [
                    UserRole::Customer->value => $customerCount,
                    UserRole::Seller->value => $sellerCount,
                    UserRole::Logistics->value => $logisticsCount,
                ],
            ],
            'action_items' => $actionItems,
        ];
    }

    /** @return Builder<RegistrationApplication> */
    private function pendingRegistrations(): Builder
    {
        return RegistrationApplication::query()
            ->where('status', ApplicationStatus::Pending)
            ->whereIn('application_type', [UserRole::Customer, UserRole::Seller, UserRole::Logistics]);
    }
}
