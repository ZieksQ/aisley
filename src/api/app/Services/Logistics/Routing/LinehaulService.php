<?php

namespace App\Services\Logistics\Routing;

use App\Enums\Logistics\LinehaulManifestStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LogisticsHub;
use App\Models\PlatformFeatureControl;
use App\Models\Shipment;
use App\Models\ShipmentRoute;
use App\Models\ShipmentRouteHop;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use App\Services\PlatformFeatureControlService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LinehaulService
{
    public static function enabled(): bool
    {
        return app(PlatformFeatureControlService::class)->isEnabled(PlatformFeatureControl::LINEHAUL);
    }

    public function depart(User $actor, array $references, string $id): array
    {
        sort($references);
        $hash = hash('sha256', json_encode($references));

        return DB::transaction(function () use ($actor, $references, $id, $hash): array {
            $hub = $actor->logisticsOrganization->hub;
            LogisticsHub::query()->whereKey($hub->id)->lockForUpdate()->firstOrFail();
            $prior = DB::table('linehaul_manifests')->where('id', $id)->first();
            if ($prior !== null) {
                if ($prior->created_by !== $actor->id || $prior->request_hash !== $hash) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This key belongs to another manifest request.');
                }

                return $this->projection($prior);
            }
            if (! self::enabled()) {
                throw FulfillmentException::conflict('LINEHAUL_DISABLED', 'Linehaul departures are paused by the platform.');
            }
            $transitions = app(FulfillmentTransitionService::class);
            $items = [];
            $target = null;
            foreach ($references as $reference) {
                $record = $transitions->routeForLogistics($actor, $reference);
                $hop = collect($record['route']['hops'] ?? [])->first(fn ($hop) => $hop['status'] !== 'arrived');
                if ($record['status'] !== 'sorted_at_hub' || $hop === null || $hop['status'] !== 'pending' || $hop['from_hub']['id'] !== $hub->id) {
                    throw FulfillmentException::conflict('LINEHAUL_NOT_READY', 'Every parcel must be sorted for its next linehaul hop.');
                }
                $target ??= $hop['to_hub']['id'];
                if ($target !== $hop['to_hub']['id']) {
                    throw FulfillmentException::conflict('LINEHAUL_MIXED_DESTINATIONS', 'A manifest can contain only parcels going to the same next hub.');
                }
                $items[] = ['reference' => $reference, 'hop_id' => $hop['id'], 'expected_revision' => $record['revision'], 'expected_hop_revision' => $hop['revision']];
            }
            DB::table('linehaul_manifests')->insert([
                'id' => $id, 'from_hub_id' => $hub->id, 'to_hub_id' => $target, 'created_by' => $actor->id,
                'status' => LinehaulManifestStatus::InTransfer->value, 'items' => json_encode($items), 'request_hash' => $hash, 'created_at' => now(), 'updated_at' => now(),
            ]);
            foreach ($items as $item) {
                $transitions->transferAtHub($actor, $item, (string) Str::uuid(), false, $id);
                DB::table('shipment_route_hops')->where('id', $item['hop_id'])->update(['linehaul_manifest_id' => $id]);
            }

            return $this->projection(DB::table('linehaul_manifests')->where('id', $id)->first());
        }, 3);
    }

    public function arrive(User $actor, string $id): array
    {
        return DB::transaction(function () use ($actor, $id): array {
            $hub = $actor->logisticsOrganization->hub;
            LogisticsHub::query()->whereKey($hub->id)->lockForUpdate()->firstOrFail();
            $manifest = DB::table('linehaul_manifests')->where('id', $id)->where('to_hub_id', $hub->id)->lockForUpdate()->first();
            if ($manifest === null) {
                throw FulfillmentException::notFound();
            }
            if (LinehaulManifestStatus::from($manifest->status) === LinehaulManifestStatus::Received) {
                return $this->projection($manifest);
            }
            foreach (json_decode($manifest->items, true) as $item) {
                $hop = ShipmentRouteHop::findOrFail($item['hop_id']);
                $shipment = Shipment::findOrFail(ShipmentRoute::findOrFail($hop->shipment_route_id)->shipment_id);
                app(FulfillmentTransitionService::class)->transferAtHub($actor, [
                    ...$item, 'expected_revision' => $shipment->revision, 'expected_hop_revision' => $hop->revision,
                ], (string) Str::uuid(), true, $id);
            }
            DB::table('linehaul_manifests')->where('id', $id)->update(['status' => LinehaulManifestStatus::Received->value, 'received_at' => now(), 'updated_at' => now()]);

            return $this->projection(DB::table('linehaul_manifests')->where('id', $id)->first());
        }, 3);
    }

    public function projection(object $manifest): array
    {
        return ['id' => $manifest->id, 'status' => $manifest->status,
            'from_hub' => LogisticsHub::find($manifest->from_hub_id)?->name,
            'to_hub' => LogisticsHub::find($manifest->to_hub_id)?->name,
            'references' => array_column(json_decode($manifest->items, true), 'reference'),
            'created_at' => $manifest->created_at, 'received_at' => $manifest->received_at];
    }
}
