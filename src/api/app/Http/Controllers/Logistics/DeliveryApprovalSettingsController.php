<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Requests\Logistics\DeliveryApprovalSettingsRequest;
use Illuminate\Http\Request;

class DeliveryApprovalSettingsController
{
    public function show(Request $request)
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();

        return response()->json(['data' => ['mode' => $organization->delivery_approval_mode->value]])->header('Cache-Control', 'private, no-store');
    }

    public function update(DeliveryApprovalSettingsRequest $request)
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();
        $organization->update(['delivery_approval_mode' => $request->validated('mode')]);

        return $this->show($request);
    }
}
