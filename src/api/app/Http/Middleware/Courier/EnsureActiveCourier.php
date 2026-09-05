<?php

namespace App\Http\Middleware\Courier;

use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveCourier
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user?->role !== UserRole::Courier) {
            return new JsonResponse(['code' => 'FORBIDDEN_ROLE', 'message' => 'This area is restricted to couriers.'], 403);
        }
        if ($user->status !== UserStatus::Active) {
            return new JsonResponse(['code' => $user->status === UserStatus::Suspended ? 'ACCOUNT_SUSPENDED' : ($user->status === UserStatus::Pending ? 'ACCOUNT_PENDING_APPROVAL' : 'ACCOUNT_INACTIVE'), 'message' => 'This Courier account is not active.'], 403);
        }
        $affiliation = $user->courierLogisticsAffiliation()->with('organization.user', 'hub')->first();
        if (! $affiliation || $affiliation->status !== CourierAffiliationStatus::Approved || $affiliation->organization?->user?->status !== UserStatus::Active || ! $affiliation->hub) {
            return new JsonResponse(['code' => 'LOGISTICS_ASSOCIATION_INVALID', 'message' => 'This Courier is not approved by an active Logistics organization.'], 403);
        }

        return $next($request);
    }
}
