<?php

namespace App\Http\Middleware\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveAdmin
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->role !== UserRole::Admin) {
            return new JsonResponse(['message' => 'This area is restricted to administrators.'], 403);
        }

        if ($user->status !== UserStatus::Active) {
            return new JsonResponse(['message' => 'Your administrator account is not active.'], 403);
        }

        return $next($request);
    }
}
