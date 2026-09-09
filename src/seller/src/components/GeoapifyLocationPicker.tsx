import { useEffect, useMemo, useRef, useState } from 'react'
import { FaLocationDot } from 'react-icons/fa6'

type Coordinates = { latitude: number; longitude: number }
type AddressForGeocoding = {
  addressLine1: string
  barangay: string
  cityMunicipality: string
  province: string
  region: string
  postalCode: string
  country: string
}
type GeoapifyGeocodingResponse = { results?: Array<{ lat?: number; lon?: number }> }

function addressQuery(address: AddressForGeocoding) {
  return [address.addressLine1, address.barangay, address.cityMunicipality, address.province, address.region, address.postalCode, address.country]
    .map((part) => part.trim()).filter(Boolean).join(', ')
}

export function GeoapifyLocationPicker({ address, apiKey, latitude, longitude, onChange }: {
  address: AddressForGeocoding
  apiKey: string
  latitude: number | null
  longitude: number | null
  onChange: (coordinates: Coordinates) => void
}) {
  const query = useMemo(() => addressQuery(address), [address])
  const canPin = Boolean(address.addressLine1.trim() && address.barangay.trim() && address.cityMunicipality.trim() && address.region.trim() && address.postalCode.trim() && address.country.trim())
  const requestRef = useRef<AbortController | null>(null)
  const queryRef = useRef(query)
  const [pinnedQuery, setPinnedQuery] = useState<string | null>(() => latitude !== null && longitude !== null ? query : null)
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const showMap = pinnedQuery === query && latitude !== null && longitude !== null

  useEffect(() => { queryRef.current = query; requestRef.current?.abort() }, [query])
  useEffect(() => () => requestRef.current?.abort(), [])

  async function pinLocation() {
    if (!canPin || geocoding) return
    setGeocoding(true); setError(null)
    const controller = new AbortController()
    requestRef.current = controller
    const parameters = new URLSearchParams({ text: query, filter: 'countrycode:ph', format: 'json', limit: '1', apiKey })
    try {
      const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${parameters}`, { signal: controller.signal })
      if (!response.ok) throw new Error('Geoapify request failed')
      const result = ((await response.json()) as GeoapifyGeocodingResponse).results?.[0]
      if (queryRef.current !== query) return
      if (!result || !Number.isFinite(result.lat) || !Number.isFinite(result.lon)) {
        setError('We could not find this address. Review the address fields and try again.')
        return
      }
      onChange({ latitude: result.lat as number, longitude: result.lon as number })
      setPinnedQuery(query)
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      if (queryRef.current === query) setError('The location service is unavailable right now. The address fields remain in this form.')
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setGeocoding(false) }
    }
  }

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm font-semibold">Pin the pickup location</p><p className="mt-1 text-xs leading-5 text-zinc-500">Finish the official address fields, then place the pin at the courier entrance.</p></div>
      <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#38104D] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed disabled:opacity-55" disabled={!canPin || geocoding} onClick={() => void pinLocation()} type="button"><FaLocationDot />{geocoding ? 'Finding location…' : latitude === null ? 'Pin location' : 'Find address again'}</button>
    </div>
    {!canPin ? <p className="mt-2 text-xs leading-5 text-zinc-500">Complete the street, Region, City or Municipality, Barangay, and postal code before pinning.</p> : null}
    {error ? <p className="mt-3 border-l-2 border-[#FF3B30] pl-3 text-xs leading-5 text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
    {showMap ? <div className="mt-3"><GeoapifyMap apiKey={apiKey} latitude={latitude} longitude={longitude} onChange={onChange} /></div> : null}
    <p className="mt-2 text-xs leading-5 text-zinc-500">Powered by <a className="underline hover:text-[#4C1268] dark:hover:text-purple-300" href="https://www.geoapify.com/" rel="noreferrer" target="_blank">Geoapify</a> · <a className="underline hover:text-[#4C1268] dark:hover:text-purple-300" href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">© OpenStreetMap contributors</a></p>
  </div>
}

function GeoapifyMap({ apiKey, latitude, longitude, onChange }: { apiKey: string; latitude: number; longitude: number; onChange: (coordinates: Coordinates) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markerRef = useRef<import('leaflet').Marker | null>(null)
  const onChangeRef = useRef(onChange)
  const coordinatesRef = useRef({ latitude, longitude })
  const [mapUnavailable, setMapUnavailable] = useState(false)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { coordinatesRef.current = { latitude, longitude } }, [latitude, longitude])
  useEffect(() => {
    if (!containerRef.current) return
    let disposed = false
    void import('leaflet').then((leaflet) => {
      if (disposed || !containerRef.current) return
      const current = coordinatesRef.current
      const map = leaflet.map(containerRef.current, { attributionControl: true, zoomControl: true }).setView([current.latitude, current.longitude], 16)
      leaflet.tileLayer(`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(apiKey)}`, {
        maxZoom: 20,
        attribution: 'Powered by <a href="https://www.geoapify.com/">Geoapify</a> | <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a> | <a href="https://openmaptiles.org/">© OpenMapTiles</a>',
      }).addTo(map)
      const icon = leaflet.divIcon({ className: '', html: '<span aria-hidden="true" style="display:block;width:24px;height:24px;border:3px solid white;border-radius:50% 50% 50% 0;background:#E6007A;box-shadow:0 2px 6px rgba(35,20,41,.28);transform:rotate(-45deg)"></span>', iconSize: [24, 24], iconAnchor: [12, 24] })
      const marker = leaflet.marker([current.latitude, current.longitude], { draggable: true, icon }).addTo(map)
      marker.on('dragend', () => { const point = marker.getLatLng(); onChangeRef.current({ latitude: point.lat, longitude: point.lng }) })
      map.on('click', (event) => { marker.setLatLng(event.latlng); onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng }) })
      mapRef.current = map; markerRef.current = marker
    }).catch(() => { if (!disposed) setMapUnavailable(true) })
    return () => { disposed = true; markerRef.current?.remove(); markerRef.current = null; mapRef.current?.remove(); mapRef.current = null }
  }, [apiKey])
  useEffect(() => { markerRef.current?.setLatLng([latitude, longitude]) }, [latitude, longitude])

  if (mapUnavailable) return <div className="border-l-2 border-[#FF8800] px-3 py-2 text-sm leading-5 text-amber-800 dark:text-amber-300" role="status">The interactive map is unavailable. The pinned coordinates are still retained.</div>
  return <><div aria-label="Geoapify pickup location picker" className="h-72 w-full overflow-hidden rounded-md border border-zinc-300 bg-zinc-100 dark:border-white/15 dark:bg-[#111113]" ref={containerRef} role="region" /><p className="mt-2 text-xs leading-5 text-zinc-500">Click the map or drag the pin to the exact entrance couriers should use.</p><p aria-live="polite" className="mt-1 text-xs font-medium">Pinned at {latitude.toFixed(6)}, {longitude.toFixed(6)}</p></>
}
