<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\UpdateAccountPasswordRequest;
use App\Http\Requests\Courier\UpdateAccountProfileRequest;
use App\Http\Requests\Courier\UploadAccountProfilePhotoRequest;
use App\Http\Resources\Courier\CourierAccountResource;
use App\Models\User;
use App\Services\Courier\CourierAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

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

    public function uploadProfilePhoto(UploadAccountProfilePhotoRequest $request): JsonResponse
    {
        $courier = $this->accounts->updateProfilePhoto(
            $this->courier($request),
            $request->file('photo'),
            $this->context($request),
        );

        return $this->privateResponse([
            'message' => 'Profile photo updated successfully.',
            'account' => new CourierAccountResource($courier),
        ]);
    }

    public function profilePhoto(Request $request): StreamedResponse
    {
        $profile = $this->courier($request)->courierProfile;
        abort_unless($profile?->profile_photo_disk && $profile->profile_photo_path, 404);

        $disk = Storage::disk($profile->profile_photo_disk);
        abort_unless($disk->exists($profile->profile_photo_path), 404);

        return $disk->response(
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
        $courier = $this->accounts->removeProfilePhoto(
            $this->courier($request),
            $this->context($request),
        );

        return $this->privateResponse([
            'message' => 'Profile photo removed successfully.',
            'account' => new CourierAccountResource($courier),
        ]);
    }

    private function courier(Request $request): User
    {
        /** @var User $courier */
        $courier = $request->user();

        return $courier;
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
