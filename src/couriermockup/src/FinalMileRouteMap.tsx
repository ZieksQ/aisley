import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { apiUrl, request } from './lib/api'
import type { FinalMileRoute } from './finalMileTypes'

function routeCoordinates(route: FinalMileRoute): number[][] {
  const feature = route.geojson?.features.find((item) => item.geometry.type === 'LineString')
  const coordinates = feature?.geometry.coordinates
  if (Array.isArray(coordinates) && coordinates.length >= 2 && Array.isArray(coordinates[0])) {
    return coordinates as number[][]
  }
  return route.stops.map((stop) => [stop.longitude, stop.latitude])
}

export function FinalMileRouteMap({ scheduleId, token }: { scheduleId: string; token: string }) {
  const [route, setRoute] = useState<FinalMileRoute | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
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
    if (!route || route.stops.length === 0 || !mapContainer.current) return
    const container = mapContainer.current
    const currentRoute = route
    let disposed = false
    let destroy: (() => void) | undefined
    setMapError(null)

    void import('maplibre-gl').then((maplibre) => {
      if (disposed) return
      try {
        const map = new maplibre.Map({
          container,
          style: {
            version: 8,
            sources: {
              'geoapify-osm-bright': {
                type: 'raster',
                tiles: [apiUrl('/api/v1/courier/map-tiles/{z}/{x}/{y}.png')],
                tileSize: 256,
                attribution: 'Powered by Geoapify | © OpenStreetMap contributors | © OpenMapTiles',
              },
            },
            layers: [{ id: 'osm-bright', type: 'raster', source: 'geoapify-osm-bright' }],
          },
          center: [currentRoute.stops[0].longitude, currentRoute.stops[0].latitude],
          zoom: 11,
          transformRequest: (url: string) => url.includes('/api/v1/courier/map-tiles/')
            ? { url, headers: { Authorization: `Bearer ${token}` } } : { url },
        })
        destroy = () => map.remove()
        map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')
        map.once('style.load', () => {
          if (disposed) return
          try {
            const coordinates = routeCoordinates(currentRoute)
            if (coordinates.length >= 2) {
              map.addSource('final-mile-line', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } },
              })
              map.addLayer({
                id: 'final-mile-line-casing', type: 'line', source: 'final-mile-line',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': '#fff', 'line-width': 9 },
              })
              map.addLayer({
                id: 'final-mile-line', type: 'line', source: 'final-mile-line',
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': '#e6007a', 'line-width': 5 },
              })
            }
            const bounds = new maplibre.LngLatBounds()
            currentRoute.stops.forEach((stop) => {
              const position: [number, number] = [stop.longitude, stop.latitude]
              bounds.extend(position)
              const marker = document.createElement('div')
              marker.className = stop.kind === 'hub' ? 'route-hub-marker' : 'route-number-marker'
              marker.textContent = stop.kind === 'hub' ? 'Logistics start' : String(stop.sequence)
              marker.setAttribute('aria-label', stop.kind === 'hub' ? 'Logistics hub, route start' : `Delivery stop ${stop.sequence}`)
              new maplibre.Marker({ element: marker, anchor: stop.kind === 'hub' ? 'bottom' : 'center' }).setLngLat(position).addTo(map)
            })
            if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 56, maxZoom: 15 })
          } catch {
            setMapError('Route markers or line could not be drawn. Use the stop list.')
          }
        })
        map.on('error', () => { if (!disposed) setMapError('Map tiles could not load. Use the stop list.') })
      } catch {
        setMapError('Interactive map unavailable. Use the stop list.')
      }
    }).catch(() => { if (!disposed) setMapError('Interactive map unavailable. Use the stop list.') })
    return () => { disposed = true; destroy?.() }
  }, [route, token])

  if (!route && !error) return <p className="status-line">Calculating delivery route…</p>
  return <section className="route-manifest" aria-label="Final-mile route">
    {error ? <p className="route-unavailable" role="status">{error}</p> : null}
    {route?.status === 'unavailable' ? <p className="route-unavailable">Road route unavailable ({route.reason?.replaceAll('_', ' ')}). Known locations remain on the map; use the delivery addresses for any missing stop.</p> : null}
    {route?.status === 'ready' ?
      <dl className="route-summary"><div><dt>Stops</dt><dd>{route.summary?.stop_count}</dd></div><div><dt>Drive distance</dt><dd>{route.summary ? `${(route.summary.distance_metres / 1000).toFixed(1)} km` : 'Unavailable'}</dd></div><div><dt>Estimated drive</dt><dd>{route.summary ? `${Math.round(route.summary.duration_seconds / 60)} min` : 'Unavailable'}</dd></div></dl>
      : null}
    {route && route.stops.length > 0 ? <>
      <div className="route-map" ref={mapContainer} aria-label="Map showing the Logistics start, numbered delivery stops, and route line" />
      {mapError ? <p className="route-unavailable" role="status">{mapError}</p> : null}
      <ol className="route-stop-list" aria-label="Ordered delivery stops">{route.stops.map((stop) => <li key={`${stop.sequence}-${stop.task_id ?? 'hub'}`}><span className="stop-sequence">{stop.sequence === 0 ? 'Start' : stop.sequence}</span><span><strong>{stop.label}</strong><span className="stop-meta">{stop.kind === 'hub' ? 'Logistics hub' : 'Delivery stop'}</span></span></li>)}</ol>
      <p className="map-attribution">{route.geojson?.features[0]?.properties?.geometry_source === 'geoapify_routing' ? 'Line follows the road route.' : route.stops.length > 1 ? 'Straight line connects known stops; road geometry is unavailable.' : 'Only one location has coordinates; no route line can be drawn.'} Advisory route, not turn-by-turn navigation. Powered by Geoapify · © OpenStreetMap contributors · © OpenMapTiles.</p>
    </> : null}
  </section>
}
