import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { request } from './lib/api'
import type { FinalMileRoute } from './finalMileTypes'

export function FinalMileRouteMap({ scheduleId, token }: { scheduleId: string; token: string }) {
  const [route, setRoute] = useState<FinalMileRoute | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mapContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    setRoute(null)
    setError(null)
    request<{ data: FinalMileRoute }>(`/api/v1/courier/final-mile-batches/${scheduleId}/route`, {}, token)
      .then((result) => { if (active) setRoute(result.data) })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'Route unavailable.') })
    return () => { active = false }
  }, [scheduleId, token])

  useEffect(() => {
    if (route?.status !== 'ready' || !route.geojson || !route.map || !mapContainer.current) return
    const container = mapContainer.current
    let disposed = false
    let destroy: (() => void) | undefined
    void import('maplibre-gl').then((maplibre) => {
      if (disposed) return
      try {
        const map = new maplibre.Map({
          container,
          style: route.map!.style_url,
          center: [route.stops[0].longitude, route.stops[0].latitude],
          zoom: 11,
          transformRequest: (url: string) => url.includes('/api/v1/courier/map-')
            ? { url, headers: { Authorization: `Bearer ${token}` } } : { url },
        })
        destroy = () => map.remove()
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')
        map.on('load', () => {
          if (disposed) return
          map.addSource('final-mile-route', { type: 'geojson', data: route.geojson! })
          map.addLayer({
            id: 'final-mile-line', type: 'line', source: 'final-mile-route',
            filter: ['==', ['geometry-type'], 'LineString'],
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#e6007a', 'line-width': 5 },
          })
          map.addLayer({
            id: 'final-mile-stops', type: 'circle', source: 'final-mile-route',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: { 'circle-color': '#4c1268', 'circle-radius': 7, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
          })
          const bounds = new maplibre.LngLatBounds()
          route.stops.forEach((stop) => bounds.extend([stop.longitude, stop.latitude]))
          map.fitBounds(bounds, { padding: 40, maxZoom: 15 })
        })
        map.on('error', () => { if (!disposed) setError('Map imagery could not load. Use the stop list.') })
      } catch { setError('Interactive map unavailable. Use the stop list.') }
    }).catch(() => setError('Interactive map unavailable. Use the stop list.'))
    return () => { disposed = true; destroy?.() }
  }, [route, token])

  if (!route && !error) return <p className="status-line">Calculating delivery route…</p>
  return <section className="route-manifest" aria-label="Final-mile route">
    {error ? <p className="route-unavailable" role="status">{error}</p> : null}
    {route?.status === 'unavailable' ? <p className="route-unavailable">Route unavailable ({route.reason?.replaceAll('_', ' ')}). Use the delivery addresses.</p> : null}
    {route?.status === 'ready' ? <>
      <dl className="route-summary"><div><dt>Stops</dt><dd>{route.summary?.stop_count}</dd></div><div><dt>Drive distance</dt><dd>{((route.summary?.distance_metres ?? 0) / 1000).toFixed(1)} km</dd></div><div><dt>Estimated drive</dt><dd>{Math.round((route.summary?.duration_seconds ?? 0) / 60)} min</dd></div></dl>
      <div className="route-map" ref={mapContainer} aria-label="Map showing the delivery route line and stops" />
      <ol className="route-stop-list" aria-label="Ordered delivery stops">{route.stops.map((stop) => <li key={`${stop.sequence}-${stop.task_id ?? 'hub'}`}><span className="stop-sequence">{stop.sequence === 0 ? 'Start' : stop.sequence}</span><span><strong>{stop.label}</strong><span className="stop-meta">{stop.kind === 'hub' ? 'Logistics hub' : 'Delivery stop'}</span></span></li>)}</ol>
      <p className="map-attribution">{route.geojson?.features[0]?.properties?.geometry_source === 'geoapify_routing' ? 'Line follows the road route.' : 'Line connects stops in order; road geometry is unavailable.'} Advisory route, not turn-by-turn navigation. Powered by Geoapify · © OpenStreetMap contributors · © OpenMapTiles.</p>
    </> : null}
  </section>
}
