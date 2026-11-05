import { useEffect, useMemo, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type * as Leaflet from 'leaflet'
import { PortalButton } from '@aisley/ui/portal'
import { AssignmentIcon } from './AssignmentIcon'
import { assignmentStatus, hasPin, stageLabels } from './assignmentTypes'
import type { AssignmentStop, FleetAssignment } from './assignmentTypes'

type Pin = { work: FleetAssignment; stop: AssignmentStop & { latitude: number; longitude: number } }
type MapState = { map: Leaflet.Map; leaflet: typeof Leaflet; layer: Leaflet.LayerGroup }

export function AssignmentMap({ rows, selected, onSelect }: {
  rows: FleetAssignment[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  const element = useRef<HTMLDivElement>(null)
  const instance = useRef<MapState | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [tileError, setTileError] = useState(false)
  const [tilesLoading, setTilesLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const didFit = useRef(false)
  const previousSelection = useRef<string | null>(null)
  const points = useMemo(() => rows.flatMap((work) => work.stops.filter(hasPin).map((stop) => ({ work, stop }))), [rows])
  const apiKey = import.meta.env.GEOAPIFY_API_KEY ?? ''

  useEffect(() => {
    if (!apiKey || !element.current) return
    let disposed = false
    let resize: ResizeObserver | undefined
    let tileTimeout: ReturnType<typeof setTimeout> | undefined
    setError('')
    setTileError(false)
    setTilesLoading(true)
    void import('leaflet').then((leaflet) => {
      if (disposed || !element.current) return
      const map = leaflet.map(element.current, { scrollWheelZoom: false }).setView([12.88, 121.77], 6)
      const tiles = leaflet.tileLayer(`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(apiKey)}`, {
        maxZoom: 20,
        attribution: 'Powered by <a href="https://www.geoapify.com/">Geoapify</a> | <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a> | <a href="https://openmaptiles.org/">© OpenMapTiles</a>',
      }).addTo(map)
      tiles.on('tileerror', () => { if (!disposed) { setTileError(true); setTilesLoading(false) } })
      tiles.on('load', () => { if (!disposed) { clearTimeout(tileTimeout); setTilesLoading(false) } })
      tileTimeout = setTimeout(() => { if (!disposed) { setTileError(true); setTilesLoading(false) } }, 10_000)
      instance.current = { map, leaflet, layer: leaflet.layerGroup().addTo(map) }
      resize = new ResizeObserver(() => map.invalidateSize())
      resize.observe(element.current)
      didFit.current = false
      setReady(true)
    }).catch(() => { if (!disposed) setError('The map could not load. Assignment details remain available below.') })
    return () => {
      disposed = true
      resize?.disconnect()
      clearTimeout(tileTimeout)
      instance.current?.map.remove()
      instance.current = null
      setReady(false)
    }
  }, [apiKey, attempt])

  useEffect(() => {
    if (!ready || !instance.current) return
    const { map, leaflet, layer } = instance.current
    layer.clearLayers()
    const groups = new Map<string, Pin[]>()
    for (const pin of points) {
      const key = `${pin.stop.latitude.toFixed(7)},${pin.stop.longitude.toFixed(7)}`
      groups.set(key, [...(groups.get(key) ?? []), pin])
    }
    for (const pins of groups.values()) {
      const first = pins[0]
      const unique = [...new Map(pins.map((pin) => [pin.work.id, pin])).values()]
      const chosen = pins.find((pin) => pin.work.id === selected)
        ?? pins.find((pin) => pin.work.stage === 'linehaul' && pin.stop.kind === 'origin') ?? first
      const hub = chosen.stop.kind === 'hub' || chosen.stop.kind === 'destination'
      const isSelected = pins.some((pin) => pin.work.id === selected)
      const html = renderToStaticMarkup(
        <span className={`assignment-pin ${hub ? 'assignment-pin-hub' : `assignment-pin-${chosen.work.stage}`} ${isSelected ? 'assignment-pin-selected' : ''}`}>
          <AssignmentIcon stage={chosen.work.stage} hub={hub} />
          {unique.length > 1 ? <span className="assignment-pin-count">{unique.length}</span> : null}
        </span>,
      )
      const title = unique.length > 1 ? `${unique.length} assignments at this stop` : `${stageLabels[first.work.stage]}: ${first.work.courier?.name ?? 'Courier'} · ${first.stop.label}`
      const marker = leaflet.marker([first.stop.latitude, first.stop.longitude], {
        icon: leaflet.divIcon({ className: 'assignment-map-marker', html, iconSize: [44, 44], iconAnchor: [22, 22] }),
        title, alt: title, keyboard: true, riseOnHover: true, zIndexOffset: isSelected ? 500 : 0,
      }).addTo(layer)
      const popup = document.createElement('div')
      popup.className = 'assignment-map-popup'
      const heading = document.createElement('p')
      heading.textContent = first.stop.label
      popup.append(heading)
      for (const { work } of unique) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = `${stageLabels[work.stage]} · ${work.courier?.name ?? 'Courier unavailable'} · ${work.reference} · ${assignmentStatus(work)}`
        button.addEventListener('click', () => { onSelect(work.id); map.closePopup() })
        popup.append(button)
      }
      marker.bindPopup(popup)
      marker.on('click', () => { if (unique.length === 1) onSelect(first.work.id) })
    }
    const selectedPins = points.filter((pin) => pin.work.id === selected)
    const fitting = selected !== previousSelection.current && selectedPins.length ? selectedPins : !didFit.current ? points : []
    if (fitting.length) {
      map.fitBounds(leaflet.latLngBounds(fitting.map(({ stop }) => [stop.latitude, stop.longitude])), { padding: [36, 36], maxZoom: 15, animate: false })
      didFit.current = true
    }
    previousSelection.current = selected
    // Polling replaces marker data without resetting the user's viewport.
  }, [points, selected, ready, onSelect])

  function fit() {
    if (!instance.current || !points.length) return
    const { map, leaflet } = instance.current
    map.fitBounds(leaflet.latLngBounds(points.map(({ stop }) => [stop.latitude, stop.longitude])), { padding: [36, 36], maxZoom: 15, animate: false })
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--portal-border)] px-4 py-3">
        <h4 className="font-medium">Assignment locations</h4>
        <PortalButton variant="default" onClick={fit} disabled={!ready || !points.length}>Fit shown stops</PortalButton>
      </div>
      {!apiKey || error ? (
        <div className="p-6 text-sm" role="status">
          <p>{error || 'Map unavailable. The map provider is not configured; use the assignment list and stop details.'}</p>
          {error ? <PortalButton className="mt-3" variant="default" onClick={() => setAttempt((value) => value + 1)}>Retry map</PortalButton> : null}
        </div>
      ) : null}
      {apiKey ? <div ref={element} hidden={Boolean(error)} className="assignment-map relative z-0 h-[320px] sm:h-[360px]" aria-label="Map of assignment stops, not live courier positions" /> : null}
      {apiKey && !error && tilesLoading && !tileError ? <p className="portal-secondary px-4 pt-3 text-sm" role="status">Loading map tiles… Saved assignment stops are available.</p> : null}
      {tileError ? <p role="status" className="border-t border-[var(--portal-border)] px-4 py-3 text-sm">Map tiles are unavailable. Saved stop markers and the assignment list remain available. <button className="portal-link" onClick={() => setAttempt((value) => value + 1)}>Retry tiles</button></p> : null}
      {rows.length && !points.length ? <p role="status" className="px-4 py-3 text-sm">No saved map pins for this page. Select an assignment to read its stops.</p> : null}
      <p className="portal-secondary px-4 py-3 text-sm">Saved pickup, hub and delivery stops · Not live courier GPS</p>
    </div>
  )
}
