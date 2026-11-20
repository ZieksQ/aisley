<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Resources\Logistics\PickupScheduleDetailResource;
use App\Models\PickupSchedule;
use Illuminate\Http\Request;

class PickupScheduleDetailController extends Controller
{
    public function __invoke(Request $request, string $schedule)
    {
        $org = $request->user()->logisticsOrganization()->with('hub')->firstOrFail();
        $record = PickupSchedule::query()
            ->where('logistics_organization_id', $org->id)
            ->where('logistics_hub_id', $org->hub->id)
            ->whereKey($schedule)
            ->with(['courier.courierProfile', 'orders.sellerPickupRequest.shop', 'orders.order.waybill'])
            ->firstOrFail();

        return (new PickupScheduleDetailResource($record))->response()
            ->header('Cache-Control', 'private, no-store');
    }
}
