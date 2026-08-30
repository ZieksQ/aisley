<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateOwnEmailRequest;
use App\Http\Requests\Admin\UpdateOwnPasswordRequest;
use App\Http\Requests\Admin\UpdateOwnProfileRequest;
use App\Http\Requests\Admin\UploadOwnProfilePhotoRequest;
use App\Http\Resources\Admin\AdminAccountResource;
use App\Http\Resources\Admin\AdminUserResource;
use App\Models\User;
use App\Services\Admin\AdminAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AccountController extends Controller
{
    public function __construct(private readonly AdminAccountService $accounts) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json(['account' => new AdminAccountResource($this->admin($request)->load('adminProfile'))]);
    }

    public function updateProfile(UpdateOwnProfileRequest $request): JsonResponse
    {
        $admin = $this->accounts->updateProfile($this->admin($request), $request->validated(), $this->context($request));

        return $this->updated($admin, 'Profile updated successfully.');
    }

    public function updateEmail(UpdateOwnEmailRequest $request): JsonResponse
    {
        $admin = $this->accounts->updateEmail($this->admin($request), $request->string('email')->value(), $this->context($request));

        return $this->updated($admin, 'Email updated successfully.');
    }

    public function updatePassword(UpdateOwnPasswordRequest $request): JsonResponse
    {
        $this->accounts->updatePassword($this->admin($request), $request->string('password')->value(), $this->context($request));

        return response()->json(['message' => 'Password updated successfully.']);
    }

    public function uploadProfilePhoto(UploadOwnProfilePhotoRequest $request): JsonResponse
    {
        $admin = $this->accounts->updateProfilePhoto($this->admin($request), $request->file('photo'), $this->context($request));

        return $this->updated($admin, 'Profile photo updated successfully.');
    }

    public function profilePhoto(Request $request): StreamedResponse
    {
        $profile = $this->admin($request)->adminProfile;
        abort_unless($profile?->profile_photo_disk && $profile->profile_photo_path, 404);

        return Storage::disk($profile->profile_photo_disk)->response(
            $profile->profile_photo_path,
            null,
            [
                'Content-Type' => $profile->profile_photo_mime ?? 'application/octet-stream',
                'Cache-Control' => 'private, no-store',
                'X-Content-Type-Options' => 'nosniff',
            ],
        );
    }

    public function removeProfilePhoto(Request $request): JsonResponse
    {
        $admin = $this->accounts->removeProfilePhoto($this->admin($request), $this->context($request));

        return $this->updated($admin, 'Profile photo removed successfully.');
    }

    private function admin(Request $request): User
    {
        /** @var User $admin */
        $admin = $request->user();

        return $admin;
    }

    private function context(Request $request): array
    {
        return [
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'request_id' => $request->header('X-Request-ID'),
        ];
    }

    private function updated(User $admin, string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'account' => new AdminAccountResource($admin->load('adminProfile')),
            'admin' => new AdminUserResource($admin->load(['adminProfile', 'permissions'])),
        ]);
    }
}
