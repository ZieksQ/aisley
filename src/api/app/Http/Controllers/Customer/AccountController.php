<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\UpdateAccountPasswordRequest;
use App\Http\Requests\Customer\UpdateAccountProfileRequest;
use App\Http\Requests\Customer\UploadAccountProfilePhotoRequest;
use App\Http\Resources\Customer\CustomerAccountResource;
use App\Http\Resources\Customer\CustomerNavigationResource;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Services\Customer\CustomerAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AccountController extends Controller
{
    public function __construct(private readonly CustomerAccountService $accounts) {}

    public function show(Request $request): JsonResponse
    {
        return $this->privateResponse([
            'account' => new CustomerAccountResource($this->accounts->load($this->customer($request))),
        ]);
    }

    public function updateProfile(UpdateAccountProfileRequest $request): JsonResponse
    {
        $customer = $this->accounts->updateProfile(
            $this->customer($request),
            $request->safe()->only([
                'first_name',
                'middle_name',
                'last_name',
                'contact_number',
                'sex',
                'birth_date',
            ]),
        );

        return $this->privateResponse([
            'message' => 'Profile updated successfully.',
            'account' => new CustomerAccountResource($customer),
            'customer' => new CustomerNavigationResource($customer),
        ]);
    }

    public function updatePassword(UpdateAccountPasswordRequest $request): JsonResponse
    {
        $accessToken = $request->user()?->currentAccessToken();

        $this->accounts->updatePassword(
            $this->customer($request),
            $request->string('current_password')->value(),
            $request->string('password')->value(),
            $accessToken instanceof PersonalAccessToken ? $accessToken : null,
        );

        if ($request->hasSession()) {
            $request->session()->regenerate();
            $request->session()->regenerateToken();
        }

        return $this->privateResponse([
            'message' => 'Password updated successfully. Other app access tokens have been revoked.',
        ]);
    }

    public function uploadProfilePhoto(UploadAccountProfilePhotoRequest $request): JsonResponse
    {
        $customer = $this->accounts->updateProfilePhoto(
            $this->customer($request),
            $request->file('photo'),
            $this->context($request),
        );

        return $this->privateResponse([
            'message' => 'Profile photo updated successfully.',
            'account' => new CustomerAccountResource($customer),
            'customer' => new CustomerNavigationResource($customer),
        ]);
    }

    public function profilePhoto(Request $request): StreamedResponse
    {
        $profile = $this->customer($request)->customerProfile;
        abort_unless($profile?->profile_photo_disk && $profile->profile_photo_path, 404);

        return Storage::disk($profile->profile_photo_disk)->response(
            $profile->profile_photo_path,
            null,
            [
                'Content-Type' => $profile->profile_photo_mime ?? 'application/octet-stream',
                'Cache-Control' => 'private, no-store',
                'Pragma' => 'no-cache',
                'X-Content-Type-Options' => 'nosniff',
            ],
        );
    }

    public function removeProfilePhoto(Request $request): JsonResponse
    {
        $customer = $this->accounts->removeProfilePhoto(
            $this->customer($request),
            $this->context($request),
        );

        return $this->privateResponse([
            'message' => 'Profile photo removed successfully.',
            'account' => new CustomerAccountResource($customer),
            'customer' => new CustomerNavigationResource($customer),
        ]);
    }

    private function customer(Request $request): User
    {
        /** @var User $customer */
        $customer = $request->user();

        return $customer;
    }

    /** @return array<string, string|null> */
    private function context(Request $request): array
    {
        return [
            'ip_address' => $request->ip(),
            'request_id' => $request->header('X-Request-ID'),
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
