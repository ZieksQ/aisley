<?php

namespace App\Http\Controllers\Seller;

use App\Enums\AddressType;
use App\Enums\ApplicationStatus;
use App\Enums\CategoryStatus;
use App\Enums\DocumentType;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\ForgotPasswordRequest;
use App\Http\Requests\Seller\LoginRequest;
use App\Http\Requests\Seller\RegisterRequest;
use App\Http\Requests\Seller\ResetPasswordRequest;
use App\Http\Resources\Seller\SellerUserResource;
use App\Models\ShopCategory;
use App\Models\User;
use App\Notifications\Seller\ResetPasswordNotification;
use App\Services\Notifications\AdminNotificationService;
use App\Services\Seller\RegistrationEvidenceService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class AuthController extends Controller
{
    private const MAX_LOGIN_ATTEMPTS = 5;

    private const MAX_PASSWORD_RESET_ATTEMPTS = 5;

    public function __construct(
        private readonly RegistrationEvidenceService $registrationEvidence,
        private readonly AdminNotificationService $adminNotifications,
    ) {}

    public function registrationOptions(): JsonResponse
    {
        $shopCategories = ShopCategory::query()
            ->where('status', CategoryStatus::Active)
            ->with(['productCategories' => fn ($query) => $query
                ->where('status', CategoryStatus::Active)
                ->orderBy('position')
                ->orderBy('name')])
            ->orderBy('position')
            ->orderBy('name')
            ->get()
            ->map(fn (ShopCategory $shopCategory): array => [
                'id' => $shopCategory->id,
                'name' => $shopCategory->name,
                'slug' => $shopCategory->slug,
                'product_categories' => $shopCategory->productCategories->map(fn ($category): array => [
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                ])->values(),
            ]);

        return response()->json(['shop_categories' => $shopCategories]);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $email = (string) $request->input('email');
        $storedEvidence = [];

        if ($this->sellerExists($email)) {
            return $this->emailAlreadyRegisteredResponse();
        }

        try {
            $user = DB::transaction(function () use ($request, $email, &$storedEvidence): User {
                $user = User::create([
                    'email' => $email,
                    'password' => (string) $request->input('password'),
                    'role' => UserRole::Seller,
                    'status' => UserStatus::Pending,
                ]);

                $user->sellerProfile()->create($request->safe()->only([
                    'first_name',
                    'last_name',
                    'middle_name',
                    'contact_number',
                    'sex',
                    'birth_date',
                ]));

                $application = $user->registrationApplications()->create([
                    'application_type' => UserRole::Seller,
                    'status' => ApplicationStatus::Pending,
                    'submitted_at' => now(),
                ]);

                $recipientName = trim(implode(' ', array_filter([
                    $request->input('first_name'),
                    $request->input('middle_name'),
                    $request->input('last_name'),
                ])));
                $address = $request->validated('address');

                $user->addresses()->create([
                    'type' => AddressType::Both,
                    'label' => 'Business address',
                    'recipient_name' => $recipientName,
                    'contact_number' => (string) $request->input('contact_number'),
                    'address_line_1' => $address['address_line_1'],
                    'address_line_2' => $address['address_line_2'] ?? null,
                    'barangay' => $address['barangay'],
                    'city_municipality' => $address['city_municipality'],
                    'province' => $address['province'],
                    'region' => $address['region'],
                    'postal_code' => $address['postal_code'],
                    'country' => 'Philippines',
                    'is_default' => true,
                ]);

                $businessName = trim((string) $request->input('business_name'));
                $slugBase = Str::slug($businessName) ?: 'seller-shop';
                $user->shop()->create([
                    'shop_category_id' => (string) $request->input('shop_category_id'),
                    'name' => $businessName,
                    'slug' => $slugBase.'-'.substr($user->id, 0, 8),
                    'status' => ShopStatus::Pending,
                    'contact_email' => $email,
                    'contact_number' => (string) $request->input('contact_number'),
                ]);

                foreach ([
                    'government_id' => DocumentType::GovernmentId,
                    'business_permit' => DocumentType::BusinessRegistration,
                ] as $field => $type) {
                    $document = $this->registrationEvidence->store(
                        $user,
                        $application,
                        $request->file($field),
                        $type,
                    );
                    $storedEvidence[] = [$document->disk, $document->path];
                }

                return $user;
            });
        } catch (Throwable $exception) {
            foreach ($storedEvidence as [$disk, $path]) {
                Storage::disk($disk)->delete($path);
            }

            if ($exception instanceof QueryException && $this->sellerExists($email)) {
                return $this->emailAlreadyRegisteredResponse();
            }

            throw $exception;
        }

        $application = $user->registrationApplications()->latest('submitted_at')->firstOrFail();
        try {
            $this->adminNotifications->registrationSubmitted($application);
        } catch (Throwable $exception) {
            report($exception);
        }

        return response()->json([
            'message' => 'Registration submitted for approval.',
            'seller' => new SellerUserResource($this->loadSeller($user)),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        if (RateLimiter::tooManyAttempts($request->throttleKey(), self::MAX_LOGIN_ATTEMPTS)) {
            return $this->rateLimitedResponse($request->throttleKey());
        }

        $user = User::query()
            ->where('email', (string) $request->input('email'))
            ->where('role', UserRole::Seller)
            ->first();

        if (! $user || ! Hash::check((string) $request->input('password'), $user->password)) {
            RateLimiter::hit($request->throttleKey());

            return response()->json([
                'code' => 'INVALID_CREDENTIALS',
                'message' => 'The email or password is incorrect.',
                'errors' => [
                    'email' => ['The email or password is incorrect.'],
                ],
            ], 422);
        }

        RateLimiter::clear($request->throttleKey());

        if ($user->status !== UserStatus::Active) {
            return $this->inactiveAccountResponse($user->status);
        }

        Auth::guard('web')->login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        return response()->json([
            'message' => 'Signed in successfully.',
            'seller' => new SellerUserResource($this->loadSeller($user)),
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'seller' => new SellerUserResource($this->loadSeller($user)),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        Auth::guard('sanctum')->forgetUser();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Signed out successfully.',
        ]);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        if (RateLimiter::tooManyAttempts($request->throttleKey(), self::MAX_PASSWORD_RESET_ATTEMPTS)) {
            return $this->rateLimitedResponse($request->throttleKey());
        }

        RateLimiter::hit($request->throttleKey(), (int) config('seller.auth.password_reset_throttle_seconds', 60));

        $email = (string) $request->input('email');
        $user = User::query()
            ->where('email', $email)
            ->where('role', UserRole::Seller)
            ->where('status', UserStatus::Active)
            ->first();

        if ($user) {
            $token = Str::random(64);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email, 'role' => UserRole::Seller->value],
                ['token' => Hash::make($token), 'created_at' => now()],
            );

            $user->notify(new ResetPasswordNotification($token));
        }

        return response()->json([
            'message' => 'If a Seller account exists for that email, we will send password reset instructions.',
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        if (RateLimiter::tooManyAttempts($request->throttleKey(), self::MAX_PASSWORD_RESET_ATTEMPTS)) {
            return $this->rateLimitedResponse($request->throttleKey());
        }

        $email = (string) $request->input('email');
        $passwordWasReset = DB::transaction(function () use ($request, $email): bool {
            $reset = DB::table('password_reset_tokens')
                ->where('email', $email)
                ->where('role', UserRole::Seller->value)
                ->lockForUpdate()
                ->first();

            $expiresAt = $reset?->created_at
                ? Carbon::parse($reset->created_at)->addMinutes((int) config('seller.auth.password_reset_expire_minutes', 60))
                : null;

            if (! $reset || ! Hash::check((string) $request->input('token'), $reset->token) || $expiresAt?->isPast()) {
                return false;
            }

            $user = User::query()
                ->where('email', $email)
                ->where('role', UserRole::Seller)
                ->where('status', UserStatus::Active)
                ->first();

            if (! $user) {
                return false;
            }

            $user->forceFill([
                'password' => (string) $request->input('password'),
                'remember_token' => Str::random(60),
            ])->save();

            $user->tokens()->delete();

            DB::table('password_reset_tokens')
                ->where('email', $email)
                ->where('role', UserRole::Seller->value)
                ->delete();

            return true;
        });

        if (! $passwordWasReset) {
            RateLimiter::hit(
                $request->throttleKey(),
                (int) config('seller.auth.password_reset_throttle_seconds', 60),
            );

            return response()->json([
                'code' => 'INVALID_RESET_TOKEN',
                'message' => 'This password reset link is invalid or has expired.',
                'errors' => [
                    'token' => ['This password reset link is invalid or has expired.'],
                ],
            ], 422);
        }

        RateLimiter::clear($request->throttleKey());

        return response()->json([
            'message' => 'Password reset successfully.',
        ]);
    }

    private function sellerExists(string $email): bool
    {
        return User::query()
            ->where('email', $email)
            ->where('role', UserRole::Seller)
            ->exists();
    }

    private function loadSeller(User $user): User
    {
        return $user->loadMissing(['sellerProfile', 'shop.shopCategory']);
    }

    private function emailAlreadyRegisteredResponse(): JsonResponse
    {
        return response()->json([
            'code' => 'EMAIL_ALREADY_REGISTERED',
            'message' => 'A Seller account with this email already exists. Sign in instead or reset your password.',
            'errors' => [
                'email' => ['A Seller account with this email already exists.'],
            ],
        ], 422);
    }

    private function inactiveAccountResponse(UserStatus $status): JsonResponse
    {
        [$code, $message] = match ($status) {
            UserStatus::Pending => ['ACCOUNT_PENDING_APPROVAL', 'Your account is waiting for admin approval.'],
            UserStatus::Rejected => ['ACCOUNT_REJECTED', 'Your account registration was not approved.'],
            UserStatus::Suspended => ['ACCOUNT_SUSPENDED', 'Your account is suspended.'],
            default => ['ACCOUNT_INACTIVE', 'Your account is not active.'],
        };

        return response()->json([
            'code' => $code,
            'message' => $message,
        ], 403);
    }

    private function rateLimitedResponse(string $key): JsonResponse
    {
        $seconds = RateLimiter::availableIn($key);

        return response()->json([
            'code' => 'RATE_LIMITED',
            'message' => "Too many attempts. Try again in {$seconds} seconds.",
        ], 429, ['Retry-After' => (string) $seconds]);
    }
}
