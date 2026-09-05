<?php

namespace App\Http\Controllers\Logistics;

use App\Enums\ApplicationStatus;
use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\CourierLogisticsAffiliation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourierApprovalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $org = $request->user()->logisticsOrganization;
        abort_unless($org, 403);

        return response()->json(['data' => CourierLogisticsAffiliation::query()->where('logistics_organization_id', $org->id)->where('status', CourierAffiliationStatus::Pending)->with('courier.courierProfile')->orderBy('created_at')->get()->map(fn ($a) => ['id' => $a->id, 'courier' => ['id' => $a->courier_id, 'email' => $a->courier->email, 'name' => trim($a->courier->courierProfile->first_name.' '.$a->courier->courierProfile->last_name)]])]);
    }

    public function decide(Request $request, CourierLogisticsAffiliation $affiliation, string $decision): JsonResponse
    {
        $validated = $request->validate(['reason' => [$decision === 'reject' ? 'required' : 'nullable', 'string', 'max:2000']]);
        abort_unless(in_array($decision, ['approve', 'reject'], true), 404);
        $reviewer = $request->user();
        $org = $reviewer->logisticsOrganization;
        abort_unless($org && $affiliation->logistics_organization_id === $org->id, 404);
        DB::transaction(function () use ($affiliation, $reviewer, $decision, $validated) {
            $a = CourierLogisticsAffiliation::query()->whereKey($affiliation->id)->lockForUpdate()->firstOrFail();
            abort_unless($a->status === CourierAffiliationStatus::Pending, 409);
            $approved = $decision === 'approve';
            $a->update(['status' => $approved ? CourierAffiliationStatus::Approved : CourierAffiliationStatus::Rejected, 'reviewer_id' => $reviewer->id, 'reviewed_at' => now(), 'rejection_reason' => $approved ? null : $validated['reason']]);
            $a->courier->update(['status' => $approved ? UserStatus::Active : UserStatus::Rejected]);
            $a->courier->registrationApplications()->where('application_type', UserRole::Courier)->update(['status' => $approved ? ApplicationStatus::Approved : ApplicationStatus::Rejected, 'reviewer_id' => $reviewer->id, 'reviewed_at' => now(), 'rejection_reason' => $approved ? null : $validated['reason']]);
        });

        return response()->json(['message' => $decision === 'approve' ? 'Courier approved.' : 'Courier rejected.']);
    }
}
