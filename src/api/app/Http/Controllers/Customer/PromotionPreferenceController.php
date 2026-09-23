<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\UpdatePromotionPreferenceRequest;
use App\Models\CustomerProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PromotionPreferenceController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var User $customer */
        $customer = $request->user();

        return $this->response($customer->customerProfile);
    }

    public function update(UpdatePromotionPreferenceRequest $request): JsonResponse
    {
        /** @var User $customer */
        $customer = $request->user();
        $enabled = $request->boolean('promotional_in_app_opted_in');

        $profile = DB::transaction(function () use ($customer, $enabled): CustomerProfile {
            $profile = CustomerProfile::query()->where('user_id', $customer->id)->lockForUpdate()->first();
            abort_unless($profile, 409, 'Complete your Customer profile before updating preferences.');
            if ($profile->promotional_in_app_opted_in !== $enabled) {
                $profile->update([
                    'promotional_in_app_opted_in' => $enabled,
                    'promotional_in_app_opted_in_at' => $enabled ? now() : null,
                ]);
            }

            return $profile;
        });

        return $this->response($profile);
    }

    private function response(?CustomerProfile $profile): JsonResponse
    {
        return response()->json(['data' => [
            'promotional_in_app_opted_in' => (bool) $profile?->promotional_in_app_opted_in,
            'promotional_in_app_opted_in_at' => $profile?->promotional_in_app_opted_in_at?->toIso8601String(),
        ]])->header('Cache-Control', 'private, no-store');
    }
}
