<?php

namespace App\Http\Controllers\Logistics;

use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Http\Controllers\Controller;
use App\Models\HubConnection;
use App\Models\HubServiceArea;
use App\Models\LinehaulTrip;
use App\Models\LogisticsHub;
use App\Services\Logistics\Routing\LinehaulService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LinehaulController extends Controller
{
    public function index(Request $request, LinehaulService $service)
    {
        $input = $request->validate(['search' => ['nullable', 'string', 'max:100'], 'page' => ['nullable', 'integer', 'min:1']]);
        $hub = $request->user()->logisticsOrganization->hub;
        $search = trim($input['search'] ?? '');
        $directory = LogisticsHub::whereKeyNot($hub->id)
            ->whereHas('organization.user', fn ($q) => $q->where('status', UserStatus::Active))
            ->with(['organization:id,business_name', 'address:id,city_municipality,province'])
            ->when($search !== '', fn ($q) => $q->where(function ($q) use ($search) {
                $q->whereLike('name', '%'.$search.'%')
                    ->orWhereHas('organization', fn ($q) => $q->whereLike('business_name', '%'.$search.'%'))
                    ->orWhereHas('address', fn ($q) => $q->whereLike('city_municipality', '%'.$search.'%')->orWhereLike('province', '%'.$search.'%'));
            }))
            ->orderBy('name')->orderBy('id')->paginate(20);
        $manifests = DB::table('linehaul_manifests')
            ->where(fn ($query) => $query->where('from_hub_id', $hub->id)->orWhere('to_hub_id', $hub->id))
            ->latest()->limit(50)->get();
        $tripManifestIds = LinehaulTrip::whereIn('linehaul_manifest_id', $manifests->pluck('id'))
            ->pluck('linehaul_manifest_id')->flip();

        return response()->json(['data' => [
            'enabled' => LinehaulService::enabled(),
            'ready_groups' => $service->readyGroups($request->user()),
            'manifests' => $manifests->map(fn ($manifest) => [
                ...$service->projection($manifest),
                'can_receive' => $manifest->to_hub_id === $hub->id
                    && $manifest->status === 'in_transfer'
                    && ! $tripManifestIds->has($manifest->id),
            ]),
            'hubs' => $directory->getCollection()->map(fn ($hub) => [
                'id' => $hub->id, 'name' => $hub->name, 'business_name' => $hub->organization->business_name,
                'city_municipality' => $hub->address?->city_municipality, 'province' => $hub->address?->province,
            ]),
            'hub_directory' => ['current_page' => $directory->currentPage(), 'last_page' => $directory->lastPage(), 'total' => $directory->total()],
            'service_areas' => HubServiceArea::where('logistics_hub_id', $hub->id)->orderBy('postal_code')->get(['id', 'postal_code', 'is_active', 'revision']),
            'incoming_connections' => HubConnection::where('to_hub_id', $hub->id)->with('fromHub:id,name')->get(),
            'connections' => HubConnection::where('from_hub_id', $hub->id)->with('toHub:id,name')->get(),
        ]])->header('Cache-Control', 'private, no-store');
    }

    public function depart()
    {
        throw FulfillmentException::conflict('LINEHAUL_TRIP_REQUIRED', 'Schedule a company truck and qualified driver from Dispatch before departure.');
    }

    public function arrive(Request $request, string $manifest, LinehaulService $service)
    {
        return response()->json(['data' => $service->arrive($request->user(), $manifest)]);
    }

    public function consent(Request $request, string $connection)
    {
        $input = $request->validate(['accept' => ['required', 'boolean'], 'expected_revision' => ['required', 'integer', 'min:1']]);

        return DB::transaction(function () use ($request, $connection, $input) {
            DB::table('permissions')->where('slug', 'platform-settings.manage')->lockForUpdate()->first();
            $hub = $request->user()->logisticsOrganization->hub;
            $row = HubConnection::whereKey($connection)->where('to_hub_id', $hub->id)->lockForUpdate()->first();
            if (! $row) {
                throw FulfillmentException::notFound('LINEHAUL_CONNECTION_NOT_FOUND', 'This connection is unavailable.');
            }
            if ($row->revision !== $input['expected_revision']) {
                throw FulfillmentException::conflict('LINEHAUL_CONFIG_CHANGED', 'Configuration changed. Refresh and try again.');
            }
            if ($input['accept'] && ! $row->sender_requested) {
                throw FulfillmentException::conflict('LINEHAUL_REQUEST_WITHDRAWN', 'The sender has withdrawn this connection.');
            }
            if ($input['accept'] && ! LogisticsHub::whereKey($row->from_hub_id)->whereHas('organization.user', fn ($q) => $q->where('status', UserStatus::Active))->exists()) {
                throw FulfillmentException::invalid('LINEHAUL_TARGET_INVALID', 'The requesting hub is unavailable.');
            }
            $row->update(['receiver_accepted' => $input['accept'], 'is_active' => $input['accept'], 'revision' => $row->revision + 1]);

            return response()->json(['data' => $row]);
        }, 3);
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
            $row ??= $model->newInstance([...$identity, 'created_by' => $request->user()->id]);
            $row->is_active = $input['is_active'];
            if (! $area) {
                // Sender can request or disconnect, but cannot grant receiver consent.
                $row->sender_requested = $input['is_active'];
                if (! $input['is_active']) {
                    $row->receiver_accepted = false;
                }
                $row->is_active = $input['is_active'] && $row->receiver_accepted;
            }
            if (! $area) {
                if (array_key_exists('distance_meters', $input) || array_key_exists('duration_seconds', $input)) {
                    $row->distance_meters = $input['distance_meters'] ?? null;
                    $row->duration_seconds = $input['duration_seconds'] ?? null;
                }
            }
            $row->revision = $row->exists ? $row->revision + 1 : 1;
            $row->save();

            return response()->json(['data' => $row]);
        }, 3);
    }
}
