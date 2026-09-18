<?php

namespace App\Http\Controllers\Logistics;

use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Http\Controllers\Controller;
use App\Models\HubConnection;
use App\Models\HubServiceArea;
use App\Models\LogisticsHub;
use App\Models\Shipment;
use App\Services\Logistics\Routing\LinehaulService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LinehaulController extends Controller
{
    public function index(Request $request, LinehaulService $service)
    {
        $hub = $request->user()->logisticsOrganization->hub;
        $ready = Shipment::where('current_hub_id', $hub->id)->where('status', 'sorted_at_hub')
            ->whereHas('route', fn ($q) => $q->where('status', 'planned'))->with(['route.hops', 'parcel.waybill'])->orderBy('received_at_hub_at')->orderBy('id')->limit(100)->get()
            ->map(function ($shipment) {
                $hop = $shipment->route->hops->first(fn ($hop) => $hop->status->value !== 'arrived');

                return $hop ? ['next_hub_id' => $hop->to_hub_id, 'reference' => $shipment->parcel->waybill->reference] : null;
            })->filter()->groupBy('next_hub_id')->map(fn ($items, $id) => ['next_hub' => LogisticsHub::find($id)?->name, 'references' => $items->pluck('reference')->values()])->values();

        return response()->json(['data' => [
            'enabled' => LinehaulService::enabled(),
            'ready_groups' => $ready,
            'manifests' => DB::table('linehaul_manifests')->where(fn ($q) => $q->where('from_hub_id', $hub->id)->orWhere('to_hub_id', $hub->id))
                ->latest()->limit(50)->get()->map(fn ($m) => [...$service->projection($m), 'can_receive' => $m->to_hub_id === $hub->id && $m->status === 'in_transfer']),
            'hubs' => LogisticsHub::whereKeyNot($hub->id)->whereHas('organization.user', fn ($q) => $q->where('status', UserStatus::Active))->orderBy('name')->limit(100)->get(['id', 'name']),
            'service_areas' => HubServiceArea::where('logistics_hub_id', $hub->id)->orderBy('postal_code')->get(['id', 'postal_code', 'is_active', 'revision']),
            'connections' => HubConnection::where('from_hub_id', $hub->id)->with('toHub:id,name')->get(),
        ]])->header('Cache-Control', 'private, no-store');
    }

    public function depart(Request $request, LinehaulService $service)
    {
        $input = $request->validate(['references' => ['required', 'array', 'min:1', 'max:100'], 'references.*' => ['required', 'string', 'max:128', 'distinct']]);
        if (! Str::isUuid((string) $request->header('Idempotency-Key'))) {
            throw ValidationException::withMessages(['idempotency_key' => 'A UUID Idempotency-Key is required.']);
        }

        return response()->json(['data' => $service->depart($request->user(), $input['references'], $request->header('Idempotency-Key'))]);
    }

    public function arrive(Request $request, string $manifest, LinehaulService $service)
    {
        return response()->json(['data' => $service->arrive($request->user(), $manifest)]);
    }

    public function configure(Request $request, string $kind)
    {
        $input = $request->validate($kind === 'service-areas'
            ? ['postal_code' => ['required', 'regex:/^\d{4}$/'], 'is_active' => ['required', 'boolean'], 'expected_revision' => ['nullable', 'integer', 'min:1']]
            : ['to_hub_id' => ['required', 'uuid'], 'is_active' => ['required', 'boolean'], 'expected_revision' => ['nullable', 'integer', 'min:1'],
                'distance_meters' => ['nullable', 'numeric', 'min:1', 'max:20000000', 'required_with:duration_seconds'],
                'duration_seconds' => ['nullable', 'numeric', 'min:1', 'max:2592000', 'required_with:distance_meters']]);

        return DB::transaction(function () use ($request, $kind, $input) {
            $hub = $request->user()->logisticsOrganization->hub;
            // Shared network lock also used by route snapshots and Admin configuration.
            DB::table('permissions')->where('slug', 'platform-settings.manage')->lockForUpdate()->first();
            $area = $kind === 'service-areas';
            if (! $area && ($input['to_hub_id'] === $hub->id || ! LogisticsHub::whereKey($input['to_hub_id'])->whereHas('organization.user', fn ($q) => $q->where('status', UserStatus::Active))->exists())) {
                throw FulfillmentException::invalid('LINEHAUL_TARGET_INVALID', 'Choose another active hub.', 'to_hub_id');
            }
            $identity = $area ? ['logistics_hub_id' => $hub->id, 'postal_code' => $input['postal_code']] : ['from_hub_id' => $hub->id, 'to_hub_id' => $input['to_hub_id']];
            $model = $area ? new HubServiceArea : new HubConnection;
            $row = $model->newQuery()->where($identity)->lockForUpdate()->first();
            if ($row && $row->revision !== ($input['expected_revision'] ?? null)) {
                throw FulfillmentException::conflict('LINEHAUL_CONFIG_CHANGED', 'Configuration changed. Refresh and try again.');
            }
            if ($area && $input['is_active'] && HubServiceArea::where('postal_code', $input['postal_code'])->where('is_active', true)->where('logistics_hub_id', '!=', $hub->id)->exists()) {
                throw FulfillmentException::conflict('LINEHAUL_POSTAL_TAKEN', 'Another hub already serves this postal code.');
            }
            $row ??= $model->newInstance([...$identity, 'created_by' => $request->user()->id]);
            $row->is_active = $input['is_active'];
            if (! $area) {
                $row->distance_meters = $input['distance_meters'] ?? null;
                $row->duration_seconds = $input['duration_seconds'] ?? null;
            }
            $row->revision = $row->exists ? $row->revision + 1 : 1;
            $row->save();

            return response()->json(['data' => $row]);
        }, 3);
    }
}
