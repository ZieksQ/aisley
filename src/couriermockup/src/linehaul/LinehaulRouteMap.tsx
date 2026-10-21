import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@aisley/ui'
import { apiUrl } from '../lib/api'
import { getLinehaulRoute } from './api'
import type { LinehaulHub, LinehaulRoute } from './types'

type PinnedHub = LinehaulHub & { latitude: number; longitude: number }

const reasonLabels: Record<string, string> = {
  missing_hub_coordinates: 'One or both hubs have no confirmed map pin. Ask Logistics to update the hub location.',
  provider_unconfigured: 'Road routing is not configured.',
  quota_guard: 'The daily road-routing limit has been reached.',
  provider_quota: 'The routing provider is temporarily at its request limit.',
  route_unavailable: 'No usable road route was returned for these hubs.',
  provider_failure: 'The road-routing service could not be reached.',
}

export function LinehaulRouteMap({ tripId, token }: { tripId: string; token: string }) {
  const [route, setRoute] = useState<LinehaulRoute | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    setRoute(null)
    setError(null)
    setMapError(null)
    getLinehaulRoute(tripId, token, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setRoute(result) })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Hub route unavailable. Retry when connected.')
      })
    return () => controller.abort()
  }, [tripId, token, retry])

  useEffect(() => {
    const pinned = route?.hubs.filter((hub): hub is PinnedHub => hub.latitude !== null && hub.longitude !== null) ?? []
    if (!route || pinned.length === 0 || !container.current) return
    const element = container.current
    const coordinates: [number, number][] = route.geometry?.coordinates ?? pinned.map((hub) => [hub.longitude, hub.latitude])
    let disposed = false
    let remove: (() => void) | undefined

    void import('maplibre-gl').then((maplibre) => {
      if (disposed) return
      const protocol = `linehaul-tiles-${crypto.randomUUID()}`
      try {
        maplibre.addProtocol(protocol, async (parameters, controller) => {
          const tile = parameters.url.slice(protocol.length + 3)
          if (!/^\d+\/\d+\/\d+$/.test(tile)) throw new Error('Invalid tile coordinates.')
          const response = await fetch(apiUrl(`/api/v1/courier/map-tiles/${tile}.png`), {
            headers: { Authorization: `Bearer ${token}` },
            credentials: 'omit', cache: 'no-store', signal: controller.signal,
          })
          if (!response.ok) throw new Error('Map tile unavailable.')
          return { data: await response.arrayBuffer() }
        })
        remove = () => maplibre.removeProtocol(protocol)
        const map = new maplibre.Map({
          container: element,
          style: {
            version: 8,
            sources: { tiles: {
              type: 'raster', tileSize: 256, maxzoom: 18,
              tiles: [`${protocol}://{z}/{x}/{y}`],
              attribution: 'Powered by Geoapify | © OpenStreetMap contributors | © OpenMapTiles',
            } },
            layers: [{ id: 'tiles', type: 'raster', source: 'tiles' }],
          },
          center: [pinned[0].longitude, pinned[0].latitude],
          zoom: 11,
          maxZoom: 18,
        })
        remove = () => { map.remove(); maplibre.removeProtocol(protocol) }
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')
        map.once('style.load', () => {
          if (disposed) return
          if (coordinates.length > 1) {
            map.addSource('hub-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } } })
            map.addLayer({ id: 'route-casing', type: 'line', source: 'hub-route', paint: { 'line-color': '#fff', 'line-width': 8 } })
            map.addLayer({ id: 'route-line', type: 'line', source: 'hub-route', paint: {
              'line-color': '#4c1268', 'line-width': 4,
              ...(route.geometry ? {} : { 'line-dasharray': [2, 2] }),
            } })
          }
          const bounds = new maplibre.LngLatBounds()
          coordinates.forEach((point) => bounds.extend(point))
          pinned.forEach((hub) => {
            const marker = document.createElement('div')
            marker.className = 'route-number-marker'
            marker.textContent = hub.kind === 'origin' ? 'A' : 'B'
            marker.setAttribute('aria-label', `${hub.kind === 'origin' ? 'Origin' : 'Destination'}: ${hub.name}`)
            new maplibre.Marker({ element: marker }).setLngLat([hub.longitude, hub.latitude])
              .setPopup(new maplibre.Popup().setText(hub.name)).addTo(map)
            bounds.extend([hub.longitude, hub.latitude])
          })
          map.fitBounds(bounds, { padding: { top: 48, bottom: 96, left: 48, right: 48 }, maxZoom: 15, duration: 0 })
        })
        map.on('error', () => { if (!disposed) setMapError('Map tiles could not load. Hub addresses and directions remain available below.') })
      } catch {
        if (!disposed) setMapError('Interactive map unavailable. Use the hub addresses or open directions.')
      }
    }).catch(() => { if (!disposed) setMapError('Interactive map unavailable. Use the hub addresses or open directions.') })
    return () => { disposed = true; remove?.() }
  }, [route, token])

  const destination = route?.hubs.find((hub) => hub.kind === 'destination')
  const hasPins = route?.hubs.some((hub) => hub.latitude !== null && hub.longitude !== null)

  return (
    <section className="route-manifest" aria-label="Route to the next Logistics hub">
      <div className="linehaul-map-toolbar">
        <h3>Route to the next hub</h3>
        <Button className="min-h-10 rounded-md px-4 shadow-none" disabled={!route && !error} onClick={() => setRetry((value) => value + 1)} variant="outline">Reload route</Button>
      </div>
      {!route && !error ? <p role="status">Loading hub route…</p> : null}
      {error ? <p className="route-unavailable" role="alert">{error}</p> : null}
      {route?.status === 'unavailable' ? <p className="route-unavailable" role="status">{reasonLabels[route.reason ?? ''] ?? 'Road route unavailable.'}</p> : null}
      {route?.summary ? <dl className="route-summary">
        <div><dt>Drive distance</dt><dd>{(route.summary.distance_metres / 1000).toLocaleString('en-PH', { maximumFractionDigits: 1 })} km</dd></div>
        <div><dt>Estimated drive</dt><dd>{Math.ceil(route.summary.duration_seconds / 60).toLocaleString('en-PH')} min</dd></div>
      </dl> : null}
      {hasPins ? <div className="route-map" ref={container} aria-label="Map of origin A and destination B Logistics hubs" /> : null}
      {mapError ? <p className="route-unavailable" role="status">{mapError}</p> : null}
      {route ? <>
        <ol className="route-stop-list" aria-label="Transfer hubs">
          {route.hubs.map((hub) => <li key={hub.kind}>
            <span className="stop-sequence">{hub.kind === 'origin' ? 'A' : 'B'}</span>
            <span><strong>{hub.name}</strong><span className="stop-meta">{hub.kind === 'origin' ? 'Origin hub' : 'Destination hub'} · {hub.address || 'Address unavailable'}{hub.latitude === null ? ' · Map pin unavailable' : ''}</span></span>
          </li>)}
        </ol>
        {destination && destination.latitude !== null && destination.longitude !== null ? (
          <a className="plain-link" href={`https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open directions to {destination.name} (opens a new tab)</a>
        ) : null}
        <p className="map-attribution">{route.geometry ? 'Line follows the road route.' : route.hubs.every((hub) => hub.latitude !== null) ? 'Dashed line joins the hubs directly; it is not a road route.' : 'Only confirmed hub pins are shown.'} Advisory hub-to-hub route. Opening directions uses your navigation app; it does not confirm arrival. Powered by Geoapify · © OpenStreetMap contributors · © OpenMapTiles.</p>
      </> : null}
    </section>
  )
}
