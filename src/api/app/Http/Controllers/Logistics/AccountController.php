<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\UpdateAccountOrganizationRequest;
use App\Http\Requests\Logistics\UpdateAccountPasswordRequest;
use App\Http\Requests\Logistics\UpdateAccountProfileRequest;
use App\Http\Resources\Logistics\LogisticsAccountResource;
use App\Models\User;
use App\Services\Logistics\LogisticsAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    public function __construct(private readonly LogisticsAccountService $accounts) {}

    public function show(Request $request): JsonResponse
    {
        return $this->privateResponse([
            'account' => new LogisticsAccountResource($this->accounts->load($this->logistics($request))),
        ]);
    }

    public function updateProfile(UpdateAccountProfileRequest $request): JsonResponse
    {
        $logistics = $this->accounts->updateProfile(
            $this->logistics($request),
            $request->safe()->only([
                'first_name',
                'middle_name',
                'last_name',
                'contact_number',
                'sex',
                'birth_date',
            ]),
            $this->context($request),
        );

        return $this->privateResponse([
            'message' => 'Profile updated successfully.',
            'account' => new LogisticsAccountResource($logistics),
        ]);
    }

    public function updateOrganization(UpdateAccountOrganizationRequest $request): JsonResponse
    {
        $logistics = $this->accounts->updateOrganization(
            $this->logistics($request),
            $request->safe()->only(['business_name', 'hub_name']),
            $this->context($request),
        );

        return $this->privateResponse([
            'message' => 'Organization details updated successfully.',
            'account' => new LogisticsAccountResource($logistics),
        ]);
    }

    public function updatePassword(UpdateAccountPasswordRequest $request): JsonResponse
    {
        $this->accounts->updatePassword(
            $this->logistics($request),
            $request->string('current_password')->value(),
            $request->string('password')->value(),
            $this->context($request),
        );

        if ($request->hasSession()) {
            $request->session()->regenerate();
            $request->session()->regenerateToken();
        }

        return $this->privateResponse([
            'message' => 'Password updated successfully. All Logistics access tokens have been revoked.',
        ]);
    }

    private function logistics(Request $request): User
    {
        /** @var User $logistics */
        $logistics = $request->user();

        return $logistics;
    }

    /** @return array<string, string|null> */
    private function context(Request $request): array
    {
        return [
            'ip_address' => $request->ip(),
            'request_id' => $request->header('X-Request-ID'),
            'user_agent' => $request->userAgent(),
        ];
    }

    /** @param array<string, mixed> $payload */
    private function privateResponse(array $payload): JsonResponse
    {
        return response()->json($payload)->withHeaders([
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
        ]);
    }
}
