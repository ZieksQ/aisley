<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\UpdateOwnEmailRequest;
use App\Http\Requests\Seller\UpdateOwnPasswordRequest;
use App\Http\Requests\Seller\UpdateOwnProfileRequest;
use App\Http\Requests\Seller\UpdateOwnStorefrontRequest;
use App\Http\Requests\Seller\UploadOwnProfilePhotoRequest;
use App\Http\Resources\Seller\SellerAccountResource;
use App\Http\Resources\Seller\SellerUserResource;
use App\Models\User;
use App\Services\Seller\SellerAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AccountController extends Controller
{
    public function __construct(private readonly SellerAccountService $accounts) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json(['account' => new SellerAccountResource($this->seller($request)->load(['sellerProfile', 'shop']))]);
    }

    public function updateProfile(UpdateOwnProfileRequest $request): JsonResponse
    {
        return $this->updated(
            $this->accounts->updateProfile($this->seller($request), $request->validated(), $this->context($request)),
            'Profile updated successfully.',
        );
    }

    public function updateStorefront(UpdateOwnStorefrontRequest $request): JsonResponse
    {
        return $this->updated(
            $this->accounts->updateStorefront($this->seller($request), $request->validated(), $this->context($request)),
            'Storefront updated successfully.',
        );
    }

    public function updateEmail(UpdateOwnEmailRequest $request): JsonResponse
    {
        return $this->updated(
            $this->accounts->updateEmail($this->seller($request), $request->string('email')->value(), $this->context($request)),
            'Email updated successfully.',
        );
    }

    public function updatePassword(UpdateOwnPasswordRequest $request): JsonResponse
    {
        $this->accounts->updatePassword($this->seller($request), $request->string('password')->value(), $this->context($request));

        return response()->json(['message' => 'Password updated successfully.']);
    }

    public function uploadProfilePhoto(UploadOwnProfilePhotoRequest $request): JsonResponse
    {
        return $this->updated(
            $this->accounts->updateProfilePhoto($this->seller($request), $request->file('photo'), $this->context($request)),
            'Profile photo updated successfully.',
        );
    }

    public function profilePhoto(Request $request): StreamedResponse
    {
        $profile = $this->seller($request)->sellerProfile;
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
        return $this->updated(
            $this->accounts->removeProfilePhoto($this->seller($request), $this->context($request)),
            'Profile photo removed successfully.',
        );
    }

    private function seller(Request $request): User
    {
        /** @var User $seller */
        $seller = $request->user();

        return $seller;
    }

    private function context(Request $request): array
    {
        return [
            'ip_address' => $request->ip(),
            'request_id' => $request->header('X-Request-ID'),
        ];
    }

    private function updated(User $seller, string $message): JsonResponse
    {
        return response()->json([
            'message' => $message,
            'account' => new SellerAccountResource($seller),
            'seller' => new SellerUserResource($seller),
        ]);
    }
}
