<?php

namespace App\Http\Middleware\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveAdmin
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $user?->refresh();

        if ($user?->role !== UserRole::Admin) {
            return new JsonResponse(['message' => 'This area is restricted to administrators.'], 403);
        }

        if ($user->status !== UserStatus::Active) {
            return new JsonResponse(['message' => 'Your administrator account is not active.'], 403);
        }

        if ($user->admin_archived_at) {
            return new JsonResponse(['message' => 'This administrator account is archived.'], 403);
        }
        if (($request->bearerToken() && $user->currentAccessToken() instanceof PersonalAccessToken)
            || ($request->hasSession() && (int) $request->session()->get('admin_session_version', 0) !== $user->admin_session_version)) {
            return new JsonResponse(['message' => 'Your session expired. Sign in again.'], 401);
        }
        if ($user->requiresAdminSetup() && ! $request->routeIs('admin.auth.me', 'admin.auth.logout', 'admin.auth.setup.*')) {
            return new JsonResponse(['code' => 'ADMIN_SETUP_REQUIRED', 'message' => 'Complete your account setup before continuing.'], 403, ['Cache-Control' => 'private, no-store']);
        }

        $response = $next($request);
        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }
}
