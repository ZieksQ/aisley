<?php

namespace App\Services\Admin;

use App\Enums\AdminAuditAction;
use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\RegistrationApplication;
use App\Models\User;
use App\Notifications\Admin\RegistrationDecisionNotification;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class RegistrationReviewService
{
    public function decide(
        RegistrationApplication $registration,
        User $reviewer,
        ApplicationStatus $decision,
        ?string $reason,
        ?string $ipAddress,
        ?string $userAgent,
    ): RegistrationApplication {
        $registration = DB::transaction(function () use (
            $registration,
            $reviewer,
            $decision,
            $reason,
            $ipAddress,
            $userAgent,
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

            AuditLog::create([
                'actor_id' => $reviewer->id,
                'action' => $decision === ApplicationStatus::Approved
                    ? AdminAuditAction::RegistrationApproved
                    : AdminAuditAction::RegistrationRejected,
                'auditable_type' => RegistrationApplication::class,
                'auditable_id' => $application->id,
                'old_values' => $oldValues,
                'new_values' => [
                    'application_status' => $decision->value,
                    'account_status' => $application->user->status->value,
                    'reviewer_id' => $reviewer->id,
                    'rejection_reason' => $rejectionReason,
                ],
                'ip_address' => $ipAddress,
                'user_agent' => $userAgent,
                'created_at' => $reviewedAt,
            ]);

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
