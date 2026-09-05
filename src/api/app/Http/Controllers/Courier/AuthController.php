<?php

namespace App\Http\Controllers\Courier;

use App\Enums\AddressType;
use App\Enums\ApplicationStatus;
use App\Enums\CourierAffiliationStatus;
use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\VehicleStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\ForgotPasswordRequest;
use App\Http\Requests\Courier\LoginRequest;
use App\Http\Requests\Courier\RegisterRequest;
use App\Http\Resources\Courier\CourierUserResource;
use App\Models\Document;
use App\Models\LogisticsOrganization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class AuthController extends Controller
{
    public function options(Request $request): JsonResponse
    {
        $query = trim((string) $request->input('search', ''));
        $organizations = LogisticsOrganization::query()->whereHas('user', fn ($q) => $q->where('status', UserStatus::Active))->with('hub')->when($query !== '', fn ($q) => $q->whereRaw('LOWER(business_name) LIKE ?', ['%'.mb_strtolower($query).'%']))->orderBy('business_name')->limit(50)->get()->map(fn ($o) => ['id' => $o->id, 'business_name' => $o->business_name]);

        return response()->json(['data' => $organizations]);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $email = $request->string('email')->value();
        $stored = [];
        if (User::query()->where('email', $email)->where('role', UserRole::Courier)->exists()) {
            return $this->duplicate();
        } try {
            $user = DB::transaction(function () use ($request, $email, &$stored) {
                $org = LogisticsOrganization::query()->with('hub')->whereKey($request->input('logistics_organization_id'))->whereHas('user', fn ($q) => $q->where('status', UserStatus::Active))->lockForUpdate()->first();
                if (! $org?->hub) {
                    abort(422, 'The selected Logistics organization is unavailable.');
                } $user = User::create(['email' => $email, 'password' => $request->input('password'), 'role' => UserRole::Courier, 'status' => UserStatus::Pending]);
                $profile = $user->courierProfile()->create($request->safe()->only(['first_name', 'last_name', 'middle_name', 'contact_number', 'sex', 'birth_date']));
                $address = $request->validated('address');
                $user->addresses()->create(['type' => AddressType::Both, 'label' => 'Courier address', 'recipient_name' => trim($request->input('first_name').' '.$request->input('last_name')), 'contact_number' => $request->input('contact_number'), 'address_line_1' => $address['address_line_1'], 'address_line_2' => $address['address_line_2'] ?? null, 'barangay' => $address['barangay'], 'city_municipality' => $address['city_municipality'], 'province' => $address['province'], 'region' => $address['region'], 'postal_code' => $address['postal_code'], 'country' => 'Philippines', 'is_default' => true]);
                $application = $user->registrationApplications()->create(['application_type' => UserRole::Courier, 'status' => ApplicationStatus::Pending, 'submitted_at' => now()]);
                $user->courierLogisticsAffiliation()->create(['logistics_organization_id' => $org->id, 'logistics_hub_id' => $org->hub->id, 'status' => CourierAffiliationStatus::Pending]);
                $profile->vehicles()->create(['plate_number' => $request->input('plate_number'), 'type' => $request->input('vehicle_type'), 'status' => VehicleStatus::Active]);
                foreach (['government_id' => DocumentType::GovernmentId, 'vehicle_registration' => DocumentType::VehicleRegistration] as $field => $type) {
                    $file = $request->file($field);
                    $path = $file->storeAs('registration-evidence/'.$user->id, Str::uuid().'.'.($file->extension() === 'jpeg' ? 'jpg' : $file->extension()), config('courier.registration.evidence_disk', 'local'));
                    $stored[] = [config('courier.registration.evidence_disk', 'local'), $path];
                    Document::create(['user_id' => $user->id, 'registration_application_id' => $application->id, 'type' => $type, 'status' => DocumentStatus::Pending, 'disk' => config('courier.registration.evidence_disk', 'local'), 'path' => $path, 'original_name' => Str::limit($file->getClientOriginalName(), 255, ''), 'mime_type' => $file->getMimeType(), 'size_bytes' => $file->getSize(), 'checksum' => hash_file('sha256', $file->getRealPath()) ?: null]);
                }

                return $user;
            });
        } catch (Throwable $e) {
            foreach ($stored as [$disk,$path]) {
                Storage::disk($disk)->delete($path);
            }throw $e;
        }

        return response()->json(['message' => 'Registration submitted for Logistics approval.', 'courier' => new CourierUserResource($this->load($user))], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        if (RateLimiter::tooManyAttempts($request->throttleKey(), 5)) {
            return $this->limited($request->throttleKey());
        }$user = User::query()->where('email', $request->input('email'))->where('role', UserRole::Courier)->first();
        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            RateLimiter::hit($request->throttleKey());

            return response()->json(['code' => 'INVALID_CREDENTIALS', 'message' => 'The email or password is incorrect.'], 422);
        } RateLimiter::clear($request->throttleKey());
        $denial = $this->denial($user);
        if ($denial) {
            return $denial;
        }$token = $user->createToken($request->input('device_name'), ['courier'])->plainTextToken;

        return response()->json(['token' => $token, 'courier' => new CourierUserResource($this->load($user))]);
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json(['courier' => new CourierUserResource($this->load($request->user()))]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['message' => 'Signed out successfully.']);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        RateLimiter::hit($request->throttleKey(), 60);

        return response()->json(['message' => 'If a Courier account exists for that email, we will send password reset instructions.']);
    }

    private function load(User $u): User
    {
        return $u->loadMissing(['courierProfile', 'courierLogisticsAffiliation.organization', 'courierLogisticsAffiliation.hub']);
    }

    private function duplicate(): JsonResponse
    {
        return response()->json(['code' => 'EMAIL_ALREADY_REGISTERED', 'message' => 'A Courier account with this email already exists.', 'errors' => ['email' => ['A Courier account with this email already exists.']]], 422);
    }

    private function limited(string $key): JsonResponse
    {
        $s = RateLimiter::availableIn($key);

        return response()->json(['code' => 'RATE_LIMITED', 'message' => "Too many attempts. Try again in {$s} seconds."], 429, ['Retry-After' => (string) $s]);
    }

    private function denial(User $u): ?JsonResponse
    {
        if ($u->status !== UserStatus::Active) {
            return response()->json(['code' => $u->status === UserStatus::Suspended ? 'ACCOUNT_SUSPENDED' : ($u->status === UserStatus::Rejected ? 'ACCOUNT_REJECTED' : 'ACCOUNT_PENDING_APPROVAL'), 'message' => 'This Courier account is not active.'], 403);
        }$a = $u->courierLogisticsAffiliation()->with('organization.user', 'hub')->first();
        if (! $a || $a->status !== CourierAffiliationStatus::Approved || $a->organization?->user?->status !== UserStatus::Active || ! $a->hub) {
            return response()->json(['code' => $a?->status === CourierAffiliationStatus::Rejected ? 'ACCOUNT_REJECTED' : 'LOGISTICS_ASSOCIATION_INVALID', 'message' => 'This Courier is not approved by an active Logistics organization.'], 403);
        }

        return null;
    }
}
