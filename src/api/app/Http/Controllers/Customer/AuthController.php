<?php

namespace App\Http\Controllers\Customer;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ForgotPasswordRequest;
use App\Http\Requests\Customer\LoginRequest;
use App\Http\Requests\Customer\RegisterRequest;
use App\Http\Requests\Customer\ResetPasswordRequest;
use App\Http\Resources\Customer\CustomerNavigationResource;
use App\Http\Resources\Customer\CustomerUserResource;
use App\Models\PersonalAccessToken;
use App\Models\User;
use App\Notifications\Customer\ResetPasswordNotification;
use App\Services\Notifications\AdminNotificationService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    private const MAX_LOGIN_ATTEMPTS = 5;

    private const MAX_PASSWORD_RESET_ATTEMPTS = 5;

    public function __construct(private readonly AdminNotificationService $adminNotifications) {}

    public function register(RegisterRequest $request): JsonResponse
    {
        $email = (string) $request->input('email');

        if ($this->customerExists($email)) {
            return $this->emailAlreadyRegisteredResponse();
        }

        try {
            $user = DB::transaction(function () use ($request, $email): User {
                $user = User::create([
                    'email' => $email,
                    'password' => (string) $request->input('password'),
                    'role' => UserRole::Customer,
                    'status' => UserStatus::Pending,
                ]);

                $user->customerProfile()->create($request->safe()->only([
                    'first_name',
                    'last_name',
                    'middle_name',
                    'contact_number',
                    'sex',
                    'birth_date',
                ]));

                $user->registrationApplications()->create([
                    'application_type' => UserRole::Customer,
                    'status' => ApplicationStatus::Pending,
                    'submitted_at' => now(),
                ]);

                return $user;
            });
        } catch (QueryException $exception) {
            if ($this->customerExists($email)) {
                return $this->emailAlreadyRegisteredResponse();
            }

            throw $exception;
        }

        $application = $user->registrationApplications()->latest('submitted_at')->firstOrFail();
        try {
            $this->adminNotifications->registrationSubmitted($application);
        } catch (\Throwable $exception) {
            report($exception);
        }

        return response()->json([
            'message' => 'Registration submitted for approval.',
            'customer' => new CustomerUserResource($this->loadCustomer($user)),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        if (RateLimiter::tooManyAttempts($request->throttleKey(), self::MAX_LOGIN_ATTEMPTS)) {
            return $this->rateLimitedResponse($request->throttleKey());
        }

        $user = User::query()
            ->where('email', (string) $request->input('email'))
            ->where('role', UserRole::Customer)
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

        $response = [
            'message' => 'Signed in successfully.',
            'customer' => new CustomerNavigationResource($this->loadCustomer($user)),
        ];

        if ($request->wantsMobileToken()) {
            $response['token'] = $user->createToken(
                (string) $request->input('device_name'),
                ['customer'],
            )->plainTextToken;
        } else {
            Auth::guard('web')->login($user, $request->boolean('remember'));
            $request->session()->regenerate();
        }

        return response()->json($response);
    }

    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'customer' => new CustomerNavigationResource($this->loadCustomer($user)),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $accessToken = $request->user()?->currentAccessToken();

        if ($accessToken instanceof PersonalAccessToken) {
            $accessToken->delete();
            Auth::guard('sanctum')->forgetUser();
        } else {
            Auth::guard('web')->logout();
            Auth::guard('sanctum')->forgetUser();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'message' => 'Signed out successfully.',
        ]);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        if (RateLimiter::tooManyAttempts($request->throttleKey(), self::MAX_PASSWORD_RESET_ATTEMPTS)) {
            return $this->rateLimitedResponse($request->throttleKey());
        }

        RateLimiter::hit($request->throttleKey(), (int) config('customer.auth.password_reset_throttle_seconds', 60));

        $email = (string) $request->input('email');
        $user = User::query()
            ->where('email', $email)
            ->where('role', UserRole::Customer)
            ->where('status', UserStatus::Active)
            ->first();

        if ($user) {
            $token = Str::random(64);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $email, 'role' => UserRole::Customer->value],
                ['token' => Hash::make($token), 'created_at' => now()],
            );

            $user->notify(new ResetPasswordNotification($token));
        }

        return response()->json([
            'message' => 'If a Customer account exists for that email, we will send password reset instructions.',
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
                ->where('role', UserRole::Customer->value)
                ->lockForUpdate()
                ->first();

            $expiresAt = $reset?->created_at
                ? Carbon::parse($reset->created_at)->addMinutes((int) config('customer.auth.password_reset_expire_minutes', 60))
                : null;

            if (! $reset || ! Hash::check((string) $request->input('token'), $reset->token) || $expiresAt?->isPast()) {
                return false;
            }

            $user = User::query()
                ->where('email', $email)
                ->where('role', UserRole::Customer)
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
                ->where('role', UserRole::Customer->value)
                ->delete();

            return true;
        });

        if (! $passwordWasReset) {
            RateLimiter::hit(
                $request->throttleKey(),
                (int) config('customer.auth.password_reset_throttle_seconds', 60),
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

    private function customerExists(string $email): bool
    {
        return User::query()
            ->where('email', $email)
            ->where('role', UserRole::Customer)
            ->exists();
    }

    private function loadCustomer(User $user): User
    {
        return $user->loadMissing('customerProfile');
    }

    private function emailAlreadyRegisteredResponse(): JsonResponse
    {
        return response()->json([
            'code' => 'EMAIL_ALREADY_REGISTERED',
            'message' => 'An account with this email already exists. Sign in instead or reset your password.',
            'errors' => [
                'email' => ['An account with this email already exists.'],
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
