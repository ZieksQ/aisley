<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\RegistrationApplication;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    private const REGISTRATION_ACTION_LIMIT = 5;

    public function show(Request $request): JsonResponse
    {
        /** @var User $admin */
        $admin = $request->user();

        $canViewRegistrations = $admin->permissions()
            ->where('slug', 'registrations.view')
            ->exists();

        return response()->json([
            'data' => [
                'registrations' => $canViewRegistrations
                    ? $this->registrationOverview()
                    : null,
                'generated_at' => now()->toIso8601String(),
            ],
        ]);
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
                'total' => $customerCount + $sellerCount,
                'by_role' => [
                    UserRole::Customer->value => $customerCount,
                    UserRole::Seller->value => $sellerCount,
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
            ->whereIn('application_type', [UserRole::Customer, UserRole::Seller]);
    }
}
