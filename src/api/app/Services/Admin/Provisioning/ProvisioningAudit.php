<?php

namespace App\Services\Admin\Provisioning;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\AdminAuditAction;
use App\Models\User;
use App\Services\Audit\AuditService;
use Illuminate\Database\Eloquent\Model;

class ProvisioningAudit
{
    public function record(User $actor, Model $target, string $operation, array $before = [], array $after = []): void
    {
        app(AuditService::class)->record(
            actor: $actor,
            action: AdminAuditAction::AdminAccessChanged,
            sourceFeature: AuditSourceFeature::AdminAccountManagement,
            target: $target,
            before: $before,
            after: $after,
            metadata: ['operation' => $operation],
            ipAddress: request()->ip(),
            userAgent: request()->userAgent(),
            requestId: request()->header('X-Request-ID'),
        );
    }
}
