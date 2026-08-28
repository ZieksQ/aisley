<?php

namespace App\Http\Middleware\Admin;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminPermission
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $hasPermission = $request->user()?->permissions()
            ->where('slug', $permission)
            ->exists() ?? false;

        if (! $hasPermission) {
            return new JsonResponse([
                'message' => 'You do not have permission to perform this action.',
            ], 403);
        }

        return $next($request);
    }
}
