<?php

namespace App\Http\Controllers\Courier;

use App\Enums\PickupRouteManifestStatus;
use App\Http\Controllers\Controller;
use App\Jobs\BuildPickupRouteManifestJob;
use App\Models\PickupRouteManifest;
use App\Models\PickupSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class PickupRouteManifestController extends Controller
{
    public function show(Request $request, string $schedule): JsonResponse
    {
        $record = $this->schedule($request, $schedule);
        $manifest = PickupRouteManifest::query()
            ->where('pickup_schedule_id', $record->id)
            ->where('schedule_revision', $record->revision)
            ->first();

        if (! $manifest) {
            $manifest = PickupRouteManifest::create([
                'pickup_schedule_id' => $record->id,
                'schedule_revision' => $record->revision,
                'status' => PickupRouteManifestStatus::Pending,
            ]);
        }
        if ($manifest->status === PickupRouteManifestStatus::Pending) {
            BuildPickupRouteManifestJob::dispatch($record->id, $record->revision);
            $manifest->refresh();
        }

        return response()->json(['data' => $this->resource($record, $manifest)])
            ->header('Cache-Control', 'private, no-store');
    }

    public function style(Request $request): JsonResponse
    {
        $tileTemplate = $request->getSchemeAndHttpHost().'/api/v1/courier/map-tiles/{z}/{x}/{y}.png';

        return response()->json([
            'version' => 8,
            'name' => 'Aisley Courier Pickup Map',
            'sources' => [
                'geoapify' => [
                    'type' => 'raster',
                    'tiles' => [$tileTemplate],
                    'tileSize' => 256,
                    'maxzoom' => (int) config('pickup_routes.tile_max_zoom', 18),
                    'attribution' => 'Powered by Geoapify | © OpenStreetMap contributors | © OpenMapTiles',
                ],
            ],
            'layers' => [[
                'id' => 'geoapify-base',
                'type' => 'raster',
                'source' => 'geoapify',
            ]],
        ])->header('Cache-Control', 'private, no-store');
    }

    public function tile(Request $request, int $z, int $x, int $y): Response
    {
        $maxZoom = (int) config('pickup_routes.tile_max_zoom', 18);
        abort_unless($z >= 0 && $z <= $maxZoom, 404);
        $edge = (2 ** $z) - 1;
        abort_unless($x >= 0 && $x <= $edge && $y >= 0 && $y <= $edge, 404);

        $key = (string) config('services.geoapify.server_key');
        abort_if($key === '', 503, 'The route map is unavailable.');
        $style = (string) config('pickup_routes.tile_style', 'osm-carto');
        $cacheKey = "geoapify:map-tile:{$style}:{$z}:{$x}:{$y}";
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && isset($cached['body'], $cached['content_type'])) {
            return $this->tileResponse(base64_decode($cached['body'], true) ?: '', $cached['content_type']);
        }
        abort_unless($this->reserveTileCredit(), 503, 'The route map daily safety limit has been reached.');
        try {
            $provider = Http::timeout((int) config('services.geoapify.matrix_timeout', 4))
                ->retry(1, 100, throw: false)
                ->get("https://maps.geoapify.com/v1/tile/{$style}/{$z}/{$x}/{$y}.png", ['apiKey' => $key]);
        } catch (\Throwable $exception) {
            report($exception);
            abort(503, 'The route map is unavailable.');
        }
        abort_unless($provider->successful(), 503, 'The route map is unavailable.');
        $contentType = $provider->header('Content-Type') ?: 'image/png';
        Cache::put($cacheKey, ['body' => base64_encode($provider->body()), 'content_type' => $contentType], now()->addDay());

        return $this->tileResponse($provider->body(), $contentType);
    }

    private function tileResponse(string $body, string $contentType): Response
    {
        return response($body, 200, [
            'Content-Type' => $contentType,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function reserveTileCredit(): bool
    {
        $cacheKey = 'geoapify:map-tile-credits:'.now('UTC')->format('Y-m-d');
        Cache::add($cacheKey, 0, now('UTC')->endOfDay());
        $used = (int) Cache::increment($cacheKey);
        if ($used <= (int) config('pickup_routes.daily_tile_credit_limit', 500)) {
            return true;
        }
        Cache::decrement($cacheKey);

        return false;
    }

    private function schedule(Request $request, string $id): PickupSchedule
    {
        $affiliation = $request->user()->courierLogisticsAffiliation()->firstOrFail();

        return PickupSchedule::query()
            ->whereKey($id)
            ->where('courier_id', $request->user()->id)
            ->where('logistics_organization_id', $affiliation->logistics_organization_id)
            ->where('logistics_hub_id', $affiliation->logistics_hub_id)
            ->whereHas('tasks', fn ($query) => $query->where('courier_id', $request->user()->id))
            ->firstOrFail();
    }

    private function resource(PickupSchedule $schedule, PickupRouteManifest $manifest): array
    {
        $stops = $manifest->stops ?? [];
        $pickupStops = collect($stops)->where('kind', 'pickup');

        return [
            'status' => $manifest->status->value,
            'schedule' => [
                'id' => $schedule->id,
                'reference' => $schedule->reference,
                'starts_at' => $schedule->starts_at->toISOString(),
                'ends_at' => $schedule->ends_at->toISOString(),
                'timezone' => 'UTC',
                'order_count' => $schedule->tasks()->count(),
            ],
            'revision' => $manifest->schedule_revision,
            'coordinate_source' => $manifest->coordinate_source,
            'summary' => [
                'pickup_stop_count' => $pickupStops->count(),
                'parcel_count' => $pickupStops->sum(fn (array $stop): int => count($stop['tasks'] ?? [])),
                'unreachable_stop_count' => $pickupStops->where('reachable', false)->count(),
                'distance_metres' => $manifest->total_distance_metres,
                'duration_seconds' => $manifest->total_duration_seconds,
                'estimated_credits' => $manifest->estimated_credits,
                'heuristic' => 'nearest_next_stop',
                'returns_to_hub' => true,
            ],
            'stops' => $stops,
            'geojson' => $manifest->geojson,
            'calculated_at' => $manifest->calculated_at?->toISOString(),
            'reason' => $manifest->status === PickupRouteManifestStatus::Ready ? null : ($manifest->failure_reason ?? 'calculation_pending'),
            'map' => [
                'style_url' => '/api/v1/courier/map-style',
                'attribution' => ['Geoapify', 'OpenStreetMap contributors', 'OpenMapTiles'],
            ],
        ];
    }
}
