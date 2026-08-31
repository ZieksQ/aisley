<?php

namespace App\Services\Admin;

use App\Enums\AccountLifecycleAction;
use App\Enums\Admin\AuditSourceFeature;
use App\Enums\AdminAuditAction;
use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\SellerComplianceActionType;
use App\Enums\SellerComplianceCaseStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AccountLifecycleEvent;
use App\Models\PlatformPolicyVersion;
use App\Models\Product;
use App\Models\ProductComplianceRestriction;
use App\Models\SellerComplianceAction;
use App\Models\SellerComplianceCase;
use App\Models\Shop;
use App\Models\User;
use App\Notifications\Seller\SellerComplianceNotification;
use App\Services\Audit\AuditService;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Throwable;

class SellerComplianceService
{
    public function __construct(
        private readonly AuditService $auditService,
        private readonly UserAccountLifecycleService $lifecycleService,
    ) {}

    /** @param array<string, mixed> $data @param array<string, ?string> $context */
    public function create(User $admin, array $data, array $context): SellerComplianceCase
    {
        return DB::transaction(function () use ($admin, $data, $context): SellerComplianceCase {
            $seller = User::query()->whereKey($data['seller_id'])->where('role', UserRole::Seller)->with('shop')->lockForUpdate()->firstOrFail();
            abort_unless($seller->shop, 404, 'Seller shop not found.');

            $product = null;
            if (! empty($data['product_id'])) {
                $product = Product::query()->whereKey($data['product_id'])->where('shop_id', $seller->shop->id)->lockForUpdate()->firstOrFail();
            }

            $policyVersion = null;
            if (! empty($data['policy_version_id'])) {
                $policyVersion = PlatformPolicyVersion::query()
                    ->whereKey($data['policy_version_id'])
                    ->where('status', PlatformPolicyVersionStatus::Published)
                    ->lockForUpdate()
                    ->firstOrFail();
            }

            $case = SellerComplianceCase::create([
                'seller_id' => $seller->id,
                'product_id' => $product?->id,
                'policy_version_id' => $policyVersion?->id,
                'source_type' => 'manual_admin_review',
                'reason' => $data['reason'],
                'status' => SellerComplianceCaseStatus::Open,
                'revision' => 1,
                'created_by_admin_id' => $admin->id,
            ]);

            $this->audit($admin, AdminAuditAction::SellerComplianceCaseCreated, $case, [], ['status' => 'open'], $case, $context);

            return $case;
        });
    }

    /** @param array<string, ?string> $context */
    public function dismiss(User $admin, SellerComplianceCase $case, int $revision, string $idempotencyKey, string $reason, array $context): SellerComplianceCase
    {
        return DB::transaction(function () use ($admin, $case, $revision, $idempotencyKey, $reason, $context): SellerComplianceCase {
            $locked = $this->lockedCase($case);
            if ($this->replayed($locked, SellerComplianceActionType::CaseDismissed, $idempotencyKey)) {
                return $locked;
            }
            $this->assertRevision($locked, $revision);
            if ($locked->status !== SellerComplianceCaseStatus::Open) {
                throw new ConflictHttpException('Only an open case can be dismissed.');
            }

            $occurredAt = now();
            $locked->update([
                'status' => SellerComplianceCaseStatus::Dismissed,
                'dismissal_note' => $reason,
                'dismissed_by_admin_id' => $admin->id,
                'dismissed_at' => $occurredAt,
                'closed_by_admin_id' => $admin->id,
                'closed_at' => $occurredAt,
                'revision' => $locked->revision + 1,
            ]);
            $action = $this->appendAction($locked, $admin, SellerComplianceActionType::CaseDismissed, $reason, $idempotencyKey, $occurredAt);
            $this->audit($admin, AdminAuditAction::SellerComplianceCaseDismissed, $action, ['status' => 'open'], ['status' => 'dismissed'], $locked, $context);

            return $locked->refresh();
        });
    }

    /** @param array<string, ?string> $context */
    public function warn(User $admin, SellerComplianceCase $case, int $revision, string $idempotencyKey, string $reason, array $context): SellerComplianceCase
    {
        return $this->simpleConfirmedAction($admin, $case, $revision, $idempotencyKey, $reason, SellerComplianceActionType::WarningIssued, AdminAuditAction::SellerComplianceWarningIssued, $context, 'Compliance warning', $reason);
    }

    /** @param array<string, ?string> $context */
    public function restrictProduct(User $admin, SellerComplianceCase $case, int $revision, string $idempotencyKey, string $reason, array $context): SellerComplianceCase
    {
        return DB::transaction(function () use ($admin, $case, $revision, $idempotencyKey, $reason, $context): SellerComplianceCase {
            $locked = $this->lockedCase($case);
            if ($this->replayed($locked, SellerComplianceActionType::ProductRestricted, $idempotencyKey)) {
                return $locked;
            }
            $this->assertRevision($locked, $revision);
            $this->assertActionable($locked);
            if ($locked->product_id === null) {
                throw new ConflictHttpException('A Product-linked case is required for this action.');
            }

            Product::query()->whereKey($locked->product_id)->lockForUpdate()->firstOrFail();
            $active = ProductComplianceRestriction::query()->where('product_id', $locked->product_id)->where('active_marker', 'active')->whereNull('revoked_at')->lockForUpdate()->first();
            if ($active) {
                return $locked;
            }

            $occurredAt = now();
            $restriction = ProductComplianceRestriction::create([
                'product_id' => $locked->product_id,
                'case_id' => $locked->id,
                'policy_version_id' => $locked->policy_version_id,
                'active_marker' => 'active',
                'reason' => $reason,
                'imposed_by_admin_id' => $admin->id,
                'imposed_at' => $occurredAt,
            ]);
            $this->advanceConfirmed($locked, $occurredAt);
            $action = $this->appendAction($locked, $admin, SellerComplianceActionType::ProductRestricted, $reason, $idempotencyKey, $occurredAt, $restriction->id);
            $this->audit($admin, AdminAuditAction::SellerComplianceProductRestricted, $action, ['restricted' => false], ['restricted' => true], $locked, $context);
            $this->notifyAfterCommit($locked, 'Product listing restricted', $reason);

            return $locked->refresh();
        });
    }

    /** @param array<string, ?string> $context */
    public function revokeProductRestriction(User $admin, SellerComplianceCase $case, int $revision, string $idempotencyKey, string $reason, array $context): SellerComplianceCase
    {
        return DB::transaction(function () use ($admin, $case, $revision, $idempotencyKey, $reason, $context): SellerComplianceCase {
            $locked = $this->lockedCase($case);
            if ($this->replayed($locked, SellerComplianceActionType::ProductRestrictionRevoked, $idempotencyKey)) {
                return $locked;
            }
            $this->assertRevision($locked, $revision);
            if (! in_array($locked->status, [SellerComplianceCaseStatus::Confirmed, SellerComplianceCaseStatus::Closed], true)) {
                throw new ConflictHttpException('Only a confirmed or closed case can revoke its Product restriction.');
            }
            $restriction = ProductComplianceRestriction::query()->where('case_id', $locked->id)->where('active_marker', 'active')->whereNull('revoked_at')->lockForUpdate()->first();
            if (! $restriction) {
                throw new ConflictHttpException('This case has no active Product restriction.');
            }

            $occurredAt = now();
            $restriction->update([
                'active_marker' => null,
                'revoked_by_admin_id' => $admin->id,
                'revocation_reason' => $reason,
                'revoked_at' => $occurredAt,
            ]);
            $locked->increment('revision');
            $action = $this->appendAction($locked, $admin, SellerComplianceActionType::ProductRestrictionRevoked, $reason, $idempotencyKey, $occurredAt, $restriction->id);
            $this->audit($admin, AdminAuditAction::SellerComplianceProductRestrictionRevoked, $action, ['restricted' => true], ['restricted' => false], $locked, $context);
            $this->notifyAfterCommit($locked, 'Product restriction removed', $reason);

            return $locked->refresh();
        });
    }

    /** @param array<string, ?string> $context */
    public function suspendSeller(User $admin, SellerComplianceCase $case, int $revision, string $idempotencyKey, string $reason, string $confirmation, array $context): SellerComplianceCase
    {
        return DB::transaction(function () use ($admin, $case, $revision, $idempotencyKey, $reason, $confirmation, $context): SellerComplianceCase {
            $locked = $this->lockedCase($case);
            if ($this->replayed($locked, SellerComplianceActionType::SellerSuspensionReferred, $idempotencyKey)) {
                return $locked;
            }
            $this->assertRevision($locked, $revision);
            $this->assertActionable($locked);
            if ($locked->actions()->where('action', SellerComplianceActionType::SellerSuspensionReferred)->exists()) {
                return $locked;
            }

            $seller = User::query()->whereKey($locked->seller_id)->where('role', UserRole::Seller)->lockForUpdate()->firstOrFail();
            if (! hash_equals($seller->email.'/seller', $confirmation)) {
                throw new ConflictHttpException('The Seller identity confirmation does not match.');
            }
            if ($seller->status !== UserStatus::Active) {
                throw new ConflictHttpException('Only an active Seller can be suspended from compliance review.');
            }

            $this->lifecycleService->change(
                target: $seller,
                actor: $admin,
                action: AccountLifecycleAction::Suspended,
                expectedStatus: UserStatus::Active,
                reason: $reason,
                confirmation: null,
                ipAddress: $context['ip_address'] ?? null,
                userAgent: $context['user_agent'] ?? null,
                requestId: $context['request_id'] ?? null,
                sourceFeature: 'seller_compliance',
                sourceReferenceType: 'seller_compliance_case',
                sourceReferenceId: $locked->id,
            );
            $event = AccountLifecycleEvent::query()->where('user_id', $seller->id)->where('source_feature', 'seller_compliance')->where('source_reference_id', $locked->id)->latest('occurred_at')->firstOrFail();
            $occurredAt = now();
            $this->advanceConfirmed($locked, $occurredAt);
            $action = $this->appendAction($locked, $admin, SellerComplianceActionType::SellerSuspensionReferred, $reason, $idempotencyKey, $occurredAt, null, $event->id);
            $this->audit($admin, AdminAuditAction::SellerComplianceSuspensionReferred, $action, ['seller_status' => 'active'], ['seller_status' => 'suspended'], $locked, $context);
            $this->notifyAfterCommit($locked, 'Seller account suspended', $reason);

            return $locked->refresh();
        });
    }

    /** @param array<string, ?string> $context */
    public function close(User $admin, SellerComplianceCase $case, int $revision, string $idempotencyKey, string $reason, array $context): SellerComplianceCase
    {
        return DB::transaction(function () use ($admin, $case, $revision, $idempotencyKey, $reason, $context): SellerComplianceCase {
            $locked = $this->lockedCase($case);
            if ($this->replayed($locked, SellerComplianceActionType::CaseClosed, $idempotencyKey)) {
                return $locked;
            }
            $this->assertRevision($locked, $revision);
            if ($locked->status !== SellerComplianceCaseStatus::Confirmed || ! $locked->actions()->whereIn('action', [SellerComplianceActionType::WarningIssued, SellerComplianceActionType::ProductRestricted, SellerComplianceActionType::SellerSuspensionReferred])->exists()) {
                throw new ConflictHttpException('A confirmed case with at least one committed action is required before closing.');
            }
            $occurredAt = now();
            $locked->update(['status' => SellerComplianceCaseStatus::Closed, 'closed_by_admin_id' => $admin->id, 'closed_at' => $occurredAt, 'revision' => $locked->revision + 1]);
            $action = $this->appendAction($locked, $admin, SellerComplianceActionType::CaseClosed, $reason, $idempotencyKey, $occurredAt);
            $this->audit($admin, AdminAuditAction::SellerComplianceCaseClosed, $action, ['status' => 'confirmed'], ['status' => 'closed'], $locked, $context);

            return $locked->refresh();
        });
    }

    /** @param array<string, ?string> $context */
    private function simpleConfirmedAction(User $admin, SellerComplianceCase $case, int $revision, string $key, string $reason, SellerComplianceActionType $type, AdminAuditAction $auditAction, array $context, string $title, string $summary): SellerComplianceCase
    {
        return DB::transaction(function () use ($admin, $case, $revision, $key, $reason, $type, $auditAction, $context, $title, $summary): SellerComplianceCase {
            $locked = $this->lockedCase($case);
            if ($this->replayed($locked, $type, $key)) {
                return $locked;
            }
            $this->assertRevision($locked, $revision);
            $this->assertActionable($locked);
            $occurredAt = now();
            $this->advanceConfirmed($locked, $occurredAt);
            $action = $this->appendAction($locked, $admin, $type, $reason, $key, $occurredAt);
            $this->audit($admin, $auditAction, $action, [], ['action' => $type->value], $locked, $context);
            $this->notifyAfterCommit($locked, $title, $summary);

            return $locked->refresh();
        });
    }

    private function lockedCase(SellerComplianceCase $case): SellerComplianceCase
    {
        $locked = SellerComplianceCase::query()->whereKey($case->id)->lockForUpdate()->firstOrFail();
        $seller = User::query()->whereKey($locked->seller_id)->where('role', UserRole::Seller)->lockForUpdate()->firstOrFail();
        $shop = Shop::query()->where('seller_id', $seller->id)->lockForUpdate()->firstOrFail();

        if ($locked->product_id !== null) {
            Product::query()->whereKey($locked->product_id)->where('shop_id', $shop->id)->lockForUpdate()->firstOrFail();
        }

        return $locked;
    }

    private function assertRevision(SellerComplianceCase $case, int $revision): void
    {
        if ($case->revision !== $revision) {
            throw new ConflictHttpException('The case changed. Refresh and try again.');
        }
    }

    private function assertActionable(SellerComplianceCase $case): void
    {
        if (! in_array($case->status, [SellerComplianceCaseStatus::Open, SellerComplianceCaseStatus::Confirmed], true)) {
            throw new ConflictHttpException('This case no longer accepts that action.');
        }
    }

    private function advanceConfirmed(SellerComplianceCase $case, $occurredAt): void
    {
        $case->update([
            'status' => SellerComplianceCaseStatus::Confirmed,
            'confirmed_at' => $case->confirmed_at ?? $occurredAt,
            'revision' => $case->revision + 1,
        ]);
    }

    private function replayed(SellerComplianceCase $case, SellerComplianceActionType $type, string $key): bool
    {
        $action = SellerComplianceAction::query()->where('idempotency_key', $key)->lockForUpdate()->first();
        if (! $action) {
            return false;
        }
        if ($action->case_id !== $case->id || $action->action !== $type) {
            throw new ConflictHttpException('The idempotency key was already used for another action.');
        }

        return true;
    }

    private function appendAction(SellerComplianceCase $case, User $admin, SellerComplianceActionType $type, string $reason, string $key, $occurredAt, ?string $restrictionId = null, ?string $lifecycleEventId = null): SellerComplianceAction
    {
        return SellerComplianceAction::create([
            'case_id' => $case->id,
            'action' => $type,
            'reason' => $reason,
            'acted_by_admin_id' => $admin->id,
            'restriction_id' => $restrictionId,
            'account_lifecycle_event_id' => $lifecycleEventId,
            'idempotency_key' => $key,
            'occurred_at' => $occurredAt,
        ]);
    }

    /** @param array<string, mixed> $before @param array<string, mixed> $after @param array<string, ?string> $context */
    private function audit(User $admin, AdminAuditAction $action, $target, array $before, array $after, SellerComplianceCase $case, array $context): void
    {
        $this->auditService->record(
            actor: $admin,
            action: $action,
            sourceFeature: AuditSourceFeature::SellerCompliance,
            target: $target,
            before: $before,
            after: $after,
            targetSnapshot: ['case_id' => $case->id, 'seller_id' => $case->seller_id, 'product_id' => $case->product_id],
            metadata: ['policy_version_id' => $case->policy_version_id, 'reason' => $target->reason ?? $case->reason],
            ipAddress: $context['ip_address'] ?? null,
            userAgent: $context['user_agent'] ?? null,
            requestId: $context['request_id'] ?? null,
        );
    }

    private function notifyAfterCommit(SellerComplianceCase $case, string $title, string $summary): void
    {
        $sellerId = $case->seller_id;
        $caseId = $case->id;
        $productId = $case->product_id;
        DB::afterCommit(static function () use ($sellerId, $caseId, $productId, $title, $summary): void {
            try {
                User::query()->find($sellerId)?->notify(new SellerComplianceNotification($caseId, $title, $summary, $productId));
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }
}
