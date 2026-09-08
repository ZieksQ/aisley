<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\UpdateAccountPasswordRequest;
use App\Http\Requests\Courier\UpdateAccountProfileRequest;
use App\Http\Resources\Courier\CourierAccountResource;
use App\Models\User;
use App\Services\Courier\CourierAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    public function __construct(private readonly CourierAccountService $accounts) {}

    public function show(Request $request): JsonResponse
    {
        return $this->privateResponse([
            'account' => new CourierAccountResource($this->accounts->load($this->courier($request))),
        ]);
    }

    public function updateProfile(UpdateAccountProfileRequest $request): JsonResponse
    {
        $courier = $this->accounts->updateProfile(
            $this->courier($request),
            $request->safe()->only([
                'first_name',
                'middle_name',
                'last_name',
                'contact_number',
            ]),
        );

        return $this->privateResponse([
            'message' => 'Profile updated successfully.',
            'account' => new CourierAccountResource($courier),
        ]);
    }

    public function updatePassword(UpdateAccountPasswordRequest $request): JsonResponse
    {
        $this->accounts->updatePassword(
            $this->courier($request),
            $request->string('current_password')->value(),
            $request->string('password')->value(),
        );

        return $this->privateResponse([
            'message' => 'Password updated successfully. All Courier access tokens have been revoked.',
        ]);
    }

    private function courier(Request $request): User
    {
        /** @var User $courier */
        $courier = $request->user();

        return $courier;
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
