<?php

namespace App\Http\Middleware\Policy;

use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActivePolicyActor
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role?->value, config('policy-consent.required_roles', []), true)) {
            return new JsonResponse([
                'code' => 'FORBIDDEN_ROLE',
                'message' => 'This policy action is restricted to account holders.',
            ], 403);
        }

        if ($user->status !== UserStatus::Active) {
            return new JsonResponse($this->inactiveResponse($user->status), 403);
        }

        if ($user->role === UserRole::Courier) {
            $affiliation = $user->courierLogisticsAffiliation()
                ->with('organization.user', 'hub')
                ->first();

            if (
                ! $affiliation
                || $affiliation->status !== CourierAffiliationStatus::Approved
                || $affiliation->organization?->user?->status !== UserStatus::Active
                || ! $affiliation->hub
            ) {
                return new JsonResponse([
                    'code' => 'LOGISTICS_ASSOCIATION_INVALID',
                    'message' => 'This Courier is not approved by an active Logistics organization.',
                ], 403);
            }
        }

        return $next($request);
    }

    /** @return array{code: string, message: string} */
    private function inactiveResponse(UserStatus $status): array
    {
        return match ($status) {
            UserStatus::Pending => [
                'code' => 'ACCOUNT_PENDING_APPROVAL',
                'message' => 'Your account is waiting for approval.',
            ],
            UserStatus::Rejected => [
                'code' => 'ACCOUNT_REJECTED',
                'message' => 'Your account registration was not approved.',
            ],
            UserStatus::Suspended => [
                'code' => 'ACCOUNT_SUSPENDED',
                'message' => 'Your account is suspended.',
            ],
            default => [
                'code' => 'ACCOUNT_INACTIVE',
                'message' => 'Your account is not active.',
            ],
        };
    }
}
