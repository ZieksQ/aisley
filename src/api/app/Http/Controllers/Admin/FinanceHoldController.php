<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\IndexFinanceHoldRequest;
use App\Http\Resources\Admin\FinanceHoldResource;
use App\Models\FinancialHold;
use App\Models\LogisticsOrganization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class FinanceHoldController extends Controller
{
    private const RECONCILIATION_REASONS = [
        'UNPLANNED_ROUTE_RECONCILIATION_REQUIRED',
        'LOGISTICS_QUOTED_CHARGES_MISSING',
        'LOGISTICS_EVIDENCE_MISSING',
        'LINEHAUL_EVIDENCE_MISSING',
    ];

    public function index(IndexFinanceHoldRequest $request): AnonymousResourceCollection
    {
        $status = $request->validated('status', 'open');
        $search = trim((string) $request->validated('search', ''));
        $holds = FinancialHold::query()
            ->whereIn('reason_code', self::RECONCILIATION_REASONS)
            ->when($status === 'open', fn ($query) => $query->whereNull('released_at'))
            ->when($status === 'resolved', fn ($query) => $query->whereNotNull('released_at'))
            ->when($search !== '', fn ($query) => $query->whereHas('order', fn ($order) => $order->where('reference', 'like', '%'.$search.'%')))
            ->with($this->relations())
            ->latest('placed_at')
            ->paginate(20)
            ->withQueryString();

        return FinanceHoldResource::collection($holds);
    }

    public function show(string $hold): JsonResponse
    {
        $record = FinancialHold::query()
            ->whereIn('reason_code', self::RECONCILIATION_REASONS)
            ->with($this->relations())
            ->findOrFail($hold);

        return response()->json([
            'data' => FinanceHoldResource::make($record),
            'organizations' => $this->organizationOptions(),
        ]);
    }

    /** @return list<string> */
    private function relations(): array
    {
        return [
            'order.shop:id,name',
            'order.selectedLogisticsOrganization:id,business_name',
            'order.pricingSnapshot',
            'routeReconciliation',
        ];
    }

    /** @return list<array{id:string,business_name:string,hub_name:?string}> */
    private function organizationOptions(): array
    {
        return LogisticsOrganization::query()
            ->whereHas('user', fn ($query) => $query->where('status', UserStatus::Active))
            ->with('hub:id,logistics_organization_id,name')
            ->orderBy('business_name')
            ->get(['id', 'business_name'])
            ->map(fn (LogisticsOrganization $organization) => [
                'id' => $organization->id,
                'business_name' => $organization->business_name,
                'hub_name' => $organization->hub?->name,
            ])->all();
    }
}
