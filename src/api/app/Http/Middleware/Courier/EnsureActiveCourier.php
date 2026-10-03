<?php

namespace App\Http\Middleware\Courier;

use App\Enums\UserRole;
use App\Services\Courier\CourierAccessService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveCourier
{
    public function __construct(private readonly CourierAccessService $access) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user?->role !== UserRole::Courier) {
            return new JsonResponse(['code' => 'FORBIDDEN_ROLE', 'message' => 'This area is restricted to couriers.'], 403);
        }
        $denial = $this->access->denial($user);
        if ($denial) {
            return new JsonResponse($denial, 403);
        }

        return $next($request);
    }
}
