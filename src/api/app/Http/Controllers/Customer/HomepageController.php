<?php

namespace App\Http\Controllers\Customer;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\HomepageRecommendationsRequest;
use App\Http\Requests\Customer\HomepageRequest;
use App\Models\User;
use App\Services\Customer\HomepageService;
use Illuminate\Http\JsonResponse;

class HomepageController extends Controller
{
    public function __construct(private readonly HomepageService $homepage) {}

    public function show(HomepageRequest $request): JsonResponse
    {
        $authenticatedUser = $request->user('sanctum');
        $response = response()->json(
            $this->homepage->overview(
                $this->activeCustomer($authenticatedUser),
                $request->recommendationLimit(),
            ),
        );

        return $this->withCacheHeaders($response, $authenticatedUser !== null);
    }

    public function recommendations(HomepageRecommendationsRequest $request): JsonResponse
    {
        $authenticatedUser = $request->user('sanctum');
        $response = response()->json([
            'recommendations' => $this->homepage->recommendations(
                $this->activeCustomer($authenticatedUser),
                $request->recommendationLimit(),
                $request->cursor(),
            ),
        ]);

        return $this->withCacheHeaders($response, $authenticatedUser !== null);
    }

    private function activeCustomer(?User $user): ?User
    {
        if ($user?->role !== UserRole::Customer || $user->status !== UserStatus::Active) {
            return null;
        }

        return $user;
    }

    private function withCacheHeaders(JsonResponse $response, bool $hasAuthenticatedUser): JsonResponse
    {
        $response->headers->set('Vary', 'Accept, Authorization, Cookie');
        $response->headers->set(
            'Cache-Control',
            $hasAuthenticatedUser ? 'private, no-store' : 'public, max-age=60',
        );

        return $response;
    }
}
