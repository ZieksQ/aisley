<?php

namespace App\Services\Admin;

use App\Enums\AccountLifecycleAction;
use App\Enums\Admin\AuditSourceFeature;
use App\Enums\AdminAuditAction;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AccountLifecycleEvent;
use App\Models\User;
use App\Services\Audit\AuditService;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class UserAccountLifecycleService
{
    public function __construct(private readonly AuditService $auditService) {}

    public function change(
        User $target,
        User $actor,
        AccountLifecycleAction $action,
        UserStatus $expectedStatus,
        ?string $reason,
        ?string $ipAddress,
        ?string $userAgent,
        ?string $requestId = null,
        string $sourceFeature = 'user_account_management',
        ?string $sourceReferenceType = null,
        ?string $sourceReferenceId = null,
    ): User {
        return DB::transaction(function () use (
            $target,
            $actor,
            $action,
            $expectedStatus,
            $reason,
            $ipAddress,
            $userAgent,
            $requestId,
            $sourceFeature,
            $sourceReferenceType,
            $sourceReferenceId,
        ): User {
            $account = User::query()->whereKey($target->id)->lockForUpdate()->firstOrFail();

            if ($account->role === UserRole::Admin) {
                throw new NotFoundHttpException('User account not found.');
            }

            if ($account->status !== $expectedStatus) {
                throw new ConflictHttpException('The account status changed. Refresh and try again.');
            }

            $nextStatus = $this->nextStatus($action, $account->status);
            $occurredAt = now();
            $event = AccountLifecycleEvent::create([
                'user_id' => $account->id,
                'action' => $action,
                'previous_status' => $account->status,
                'new_status' => $nextStatus,
                'reason' => $reason,
                'acted_by_admin_id' => $actor->id,
                'source_feature' => $sourceFeature,
                'source_reference_type' => $sourceReferenceType,
                'source_reference_id' => $sourceReferenceId,
                'occurred_at' => $occurredAt,
            ]);

            $previousStatus = $account->status;
            $account->update(['status' => $nextStatus]);

            $this->auditService->record(
                actor: $actor,
                action: match ($action) {
                    AccountLifecycleAction::Suspended => AdminAuditAction::UserAccountSuspended,
                    AccountLifecycleAction::Restored => AdminAuditAction::UserAccountRestored,
                    AccountLifecycleAction::Deactivated => AdminAuditAction::UserAccountDeactivated,
                },
                sourceFeature: AuditSourceFeature::UserAccountManagement,
                target: $event,
                before: ['account_status' => $previousStatus->value],
                after: ['account_status' => $nextStatus->value],
                targetSnapshot: [
                    'account_id' => $account->id,
                    'role' => $account->role->value,
                ],
                metadata: [
                    'lifecycle_action' => $action->value,
                    'reason' => $reason,
                    'source_feature' => $sourceFeature,
                    'source_reference_type' => $sourceReferenceType,
                    'source_reference_id' => $sourceReferenceId,
                ],
                occurredAt: $occurredAt,
                ipAddress: $ipAddress,
                userAgent: $userAgent,
                requestId: $requestId,
            );

            return $account;
        });
    }

    private function nextStatus(AccountLifecycleAction $action, UserStatus $current): UserStatus
    {
        return match ($action) {
            AccountLifecycleAction::Suspended => $current === UserStatus::Active
                ? UserStatus::Suspended
                : throw new ConflictHttpException('Only an active account can be suspended.'),
            AccountLifecycleAction::Restored => $current === UserStatus::Suspended
                ? UserStatus::Active
                : throw new ConflictHttpException('Only a suspended account can be restored.'),
            AccountLifecycleAction::Deactivated => in_array($current, [UserStatus::Active, UserStatus::Suspended], true)
                ? UserStatus::Deactivated
                : throw new ConflictHttpException('This account cannot be deactivated from its current status.'),
        };
    }
}
