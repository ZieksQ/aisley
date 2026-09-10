import 'maplibre-gl/dist/maplibre-gl.css'
import { Button } from '@aisley/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { request } from './lib/api'
import type { PickupRouteManifest, PickupRouteManifestResponse } from './types'

function distance(value: number | null): string {
  if (value === null) return '—'
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value} m`
}

function duration(value: number | null): string {
  if (value === null) return '—'
  const minutes = Math.round(value / 60)
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`
}

function reason(value: string | null): string {
  const messages: Record<string, string> = {
    calculation_pending: 'Route calculation is queued. Pickup tasks remain available.',
    missing_hub_coordinates: 'The Logistics hub has no exact or default coordinates.',
    missing_pickup_coordinates: 'A Seller pickup has no exact or default coordinates.',
    provider_unconfigured: 'Geoapify is not configured on the server.',
    provider_quota: 'Geoapify reported that its quota is exhausted.',
    quota_guard: 'The daily matrix safety limit has been reached.',
    provider_failure: 'Geoapify could not calculate this route.',
    provider_timeout: 'The route calculation timed out.',
    malformed_matrix: 'The route provider returned an incomplete matrix.',
    schedule_unavailable: 'This schedule is no longer available for routing.',
  }
  return messages[value ?? ''] ?? 'The route map is unavailable. Use the pickup address list.'
}

function routeLine(manifest: PickupRouteManifest) {
  const apiLine = manifest.geojson?.features.find((feature) => feature.geometry.type === 'LineString')
  const coordinates = apiLine?.geometry.type === 'LineString' && apiLine.geometry.coordinates.length >= 2
    ? apiLine.geometry.coordinates
    : manifest.stops.filter((stop) => stop.reachable).map((stop) => [stop.longitude, stop.latitude])

  return {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates },
    properties: apiLine?.properties ?? { kind: 'route_line', geometry_source: 'client_stop_sequence_fallback' },
  }
}

export function PickupRouteMap({ scheduleId, token }: { scheduleId: string; token: string }) {
  const [manifest, setManifest] = useState<PickupRouteManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [webglUnavailable, setWebglUnavailable] = useState(false)
  const mapContainer = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await request<PickupRouteManifestResponse>(`/api/v1/courier/pickup-schedules/${scheduleId}/route-manifest`, {}, token)
      setManifest(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The route manifest could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [scheduleId, token])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (manifest?.status !== 'ready' || !manifest.geojson || !mapContainer.current) return
    const container = mapContainer.current
    let disposed = false
    let destroy: (() => void) | undefined

    void import('maplibre-gl').then((maplibregl) => {
      if (disposed) return
      const map = new maplibregl.Map({
        container,
        style: manifest.map.style_url,
        center: [manifest.stops[0].longitude, manifest.stops[0].latitude],
        zoom: 11,
        transformRequest: (url: string) => url.includes('/api/v1/courier/map-')
          ? { url, headers: { Authorization: `Bearer ${token}` } }
          : { url },
      })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.on('load', () => {
        map.addSource('pickup-route-line', { type: 'geojson', data: routeLine(manifest) })
        map.addSource('pickup-route', { type: 'geojson', data: manifest.geojson as never })
        map.addLayer({
          id: 'pickup-route-line-casing',
          type: 'line',
          source: 'pickup-route-line',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.95 },
        })
        map.addLayer({
          id: 'pickup-route-line',
          type: 'line',
          source: 'pickup-route-line',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#e6007a', 'line-width': 5, 'line-opacity': 1 },
        })
        map.addLayer({
          id: 'pickup-route-points',
          type: 'circle',
          source: 'pickup-route',
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': ['case', ['==', ['get', 'kind'], 'hub'], 8, 11],
            'circle-color': ['case', ['==', ['get', 'kind'], 'hub'], '#4c1268', '#e6007a'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2,
          },
        })

        const bounds = new maplibregl.LngLatBounds()
        manifest.stops.forEach((stop) => {
          bounds.extend([stop.longitude, stop.latitude])
          if (stop.kind === 'hub' && stop.sequence === 0) {
            const marker = document.createElement('div')
            marker.className = 'route-hub-marker'
            marker.textContent = 'Logistics start / end'
            marker.setAttribute('aria-label', 'Logistics hub, route start and end')
            new maplibregl.Marker({ element: marker, anchor: 'bottom' }).setLngLat([stop.longitude, stop.latitude]).addTo(map)
            return
          }
          if (stop.kind !== 'pickup') return
          const marker = document.createElement('div')
          marker.className = 'route-number-marker'
          marker.textContent = String(stop.sequence)
          marker.setAttribute('aria-label', `Pickup stop ${stop.sequence}`)
          new maplibregl.Marker({ element: marker }).setLngLat([stop.longitude, stop.latitude]).addTo(map)
        })
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 15 })
      })
      map.on('error', () => setWebglUnavailable(true))
      destroy = () => map.remove()
    }).catch(() => setWebglUnavailable(true))

    return () => {
      disposed = true
      destroy?.()
    }
  }, [manifest, token])

  return (
    <section className="route-manifest" aria-labelledby="route-manifest-heading">
      <div className="route-manifest-header">
        <div>
          <h3 id="route-manifest-heading">Bulk pickup route</h3>
          <p>Orders at the same Seller address are grouped into one stop.</p>
        </div>
        <Button className="min-h-10 rounded-md px-4 shadow-none" isLoading={loading} loadingLabel="Loading" onClick={() => void load()} variant="outline">Refresh route</Button>
      </div>

      {error ? <p className="error-message" role="alert">{error}</p> : null}
      {manifest && manifest.status !== 'ready' ? <p className="route-unavailable" role="status">{reason(manifest.reason)}</p> : null}
      {manifest?.status === 'ready' ? (
        <>
          <dl className="route-summary">
            <div><dt>Parcels</dt><dd>{manifest.summary.parcel_count}</dd></div>
            <div><dt>Pickup stops</dt><dd>{manifest.summary.pickup_stop_count}</dd></div>
            <div><dt>Route distance</dt><dd>{distance(manifest.summary.distance_metres)}</dd></div>
            <div><dt>Estimated drive</dt><dd>{duration(manifest.summary.duration_seconds)}</dd></div>
          </dl>
          <div className="route-map" hidden={webglUnavailable} ref={mapContainer} aria-label="Interactive bulk pickup route map" />
          {webglUnavailable ? <p className="route-unavailable">Interactive maps are unavailable on this device. Follow the ordered stop list below.</p> : null}
          <ol className="route-stop-list" aria-label="Ordered pickup stops">
            {manifest.stops.map((stop) => (
              <li key={`${stop.node_id}-${stop.sequence}`}>
                <span className="stop-sequence">{stop.kind === 'hub' ? (stop.sequence === 0 ? 'Start' : 'End') : stop.sequence}</span>
                <span><strong>{stop.kind === 'hub' ? 'Logistics hub' : stop.address_summary}</strong><span className="stop-meta">{stop.tasks.length > 0 ? `${stop.tasks.length} parcel${stop.tasks.length === 1 ? '' : 's'}` : 'Return point'} · {distance(stop.leg_distance_metres)} · {duration(stop.leg_duration_seconds)} · {stop.coordinate_source.replace('_', ' ')}</span></span>
              </li>
            ))}
          </ol>
          <p className="map-attribution">{manifest.geojson?.features[0]?.properties.geometry_source === 'geoapify_routing' ? 'Line follows the calculated driving route.' : 'Road geometry is unavailable; line connects the stops in order.'} The stop list remains authoritative. Not turn-by-turn navigation. Powered by Geoapify · © OpenStreetMap contributors · © OpenMapTiles.</p>
        </>
      ) : null}
    </section>
  )
}
