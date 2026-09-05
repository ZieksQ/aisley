<?php

namespace App\Http\Middleware\Logistics;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveLogistics
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->role !== UserRole::Logistics) {
            return new JsonResponse(['code' => 'FORBIDDEN_ROLE', 'message' => 'This area is restricted to Logistics accounts.'], 403);
        }

        if ($user->status !== UserStatus::Active) {
            [$code, $message] = match ($user->status) {
                UserStatus::Pending => ['ACCOUNT_PENDING_APPROVAL', 'Your account is waiting for admin approval.'],
                UserStatus::Rejected => ['ACCOUNT_REJECTED', 'Your account registration was not approved.'],
                UserStatus::Suspended => ['ACCOUNT_SUSPENDED', 'Your account is suspended.'],
                default => ['ACCOUNT_INACTIVE', 'Your account is not active.'],
            };

            return new JsonResponse(['code' => $code, 'message' => $message], 403);
        }

        return $next($request);
    }
}
