<?php

namespace App\Services\Admin;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\AdminAuditAction;
use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\RegistrationApplication;
use App\Models\User;
use App\Notifications\Admin\RegistrationDecisionNotification;
use App\Services\Audit\AuditService;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class RegistrationReviewService
{
    public function __construct(private readonly AuditService $auditService) {}

    public function decide(
        RegistrationApplication $registration,
        User $reviewer,
        ApplicationStatus $decision,
        ?string $reason,
        ?string $ipAddress,
        ?string $userAgent,
        ?string $requestId = null,
    ): RegistrationApplication {
        $registration = DB::transaction(function () use (
            $registration,
            $reviewer,
            $decision,
            $reason,
            $ipAddress,
            $userAgent,
            $requestId,
        ): RegistrationApplication {
            $application = RegistrationApplication::query()
                ->whereKey($registration->id)
                ->lockForUpdate()
                ->firstOrFail();

            $application->load('user');

            if (! in_array($application->application_type, [UserRole::Customer, UserRole::Seller], true)
                || $application->user->role !== $application->application_type) {
                throw new NotFoundHttpException('Registration application not found.');
            }

            if ($application->status !== ApplicationStatus::Pending) {
                throw new ConflictHttpException('This registration has already been reviewed.');
            }

            $oldValues = [
                'application_status' => $application->status->value,
                'account_status' => $application->user->status->value,
            ];
            $reviewedAt = now();
            $rejectionReason = $decision === ApplicationStatus::Rejected ? $reason : null;

            $application->update([
                'status' => $decision,
                'reviewer_id' => $reviewer->id,
                'reviewed_at' => $reviewedAt,
                'rejection_reason' => $rejectionReason,
            ]);

            $application->user->update([
                'status' => $decision === ApplicationStatus::Approved
                    ? UserStatus::Active
                    : UserStatus::Rejected,
            ]);

            $this->auditService->record(
                actor: $reviewer,
                action: $decision === ApplicationStatus::Approved
                    ? AdminAuditAction::RegistrationApproved
                    : AdminAuditAction::RegistrationRejected,
                sourceFeature: AuditSourceFeature::AccountApproval,
                target: $application,
                before: $oldValues,
                after: [
                    'application_status' => $decision->value,
                    'account_status' => $application->user->status->value,
                ],
                targetSnapshot: [
                    'registration_id' => $application->id,
                    'account_id' => $application->user_id,
                    'role' => $application->application_type->value,
                ],
                metadata: [
                    'decision' => $decision->value,
                ],
                occurredAt: $reviewedAt,
                ipAddress: $ipAddress,
                userAgent: $userAgent,
                requestId: $requestId,
            );

            return $application;
        });

        try {
            $registration->user->notify(new RegistrationDecisionNotification(
                $decision,
                $registration->application_type,
                $registration->rejection_reason,
            ));
        } catch (Throwable $exception) {
            report($exception);
        }

        return $registration;
    }
}
