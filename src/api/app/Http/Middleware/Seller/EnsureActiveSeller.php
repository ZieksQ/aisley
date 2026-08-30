<?php

namespace App\Http\Middleware\Seller;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveSeller
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->role !== UserRole::Seller) {
            return new JsonResponse([
                'code' => 'FORBIDDEN_ROLE',
                'message' => 'This area is restricted to sellers.',
            ], 403);
        }

        if ($user->status !== UserStatus::Active) {
            return new JsonResponse($this->statusResponse($user->status), 403);
        }

        return $next($request);
    }

    /** @return array{code: string, message: string} */
    private function statusResponse(UserStatus $status): array
    {
        return match ($status) {
            UserStatus::Pending => [
                'code' => 'ACCOUNT_PENDING_APPROVAL',
                'message' => 'Your account is waiting for admin approval.',
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
