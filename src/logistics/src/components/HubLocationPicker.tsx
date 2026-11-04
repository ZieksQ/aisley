import { AddressPinFields } from '@aisley/ui/address-pin'
import { useEffect, useRef, useState } from 'react'
import { FaLocationDot, FaSatelliteDish } from 'react-icons/fa6'

export type HubCoordinates = { latitude: number; longitude: number }

export type HubAddress = {
  addressLine1: string
  barangay: string
  cityMunicipality: string
  province: string
  region: string
  postalCode: string
  country: string
}

type GeocodingResponse = { results?: Array<{ lat?: number; lon?: number }> }

type Props = {
  address?: HubAddress
  getAddress?: () => HubAddress
  apiKey: string
  latitude: number | null
  longitude: number | null
  confirmed: boolean
  onChange: (coordinates: HubCoordinates) => void
  onConfirm: () => void
  onInvalidate: () => void
}

function queryFor(address: HubAddress): string {
  return [address.addressLine1, address.barangay, address.cityMunicipality, address.province, address.region, address.postalCode, address.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ')
}

function completeAddress(address: HubAddress): boolean {
  return Boolean(address.addressLine1.trim() && address.barangay.trim() && address.cityMunicipality.trim() && address.region.trim() && address.postalCode.trim() && address.country.trim())
}

function validCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
}

export function HubLocationPicker({ address, getAddress, apiKey, latitude, longitude, confirmed, onChange, onConfirm, onInvalidate }: Props) {
  const requestRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const [geocoding, setGeocoding] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; requestRef.current?.abort() }
  }, [])

  async function suggestLocation() {
    const currentAddress = getAddress?.() ?? address
    if (!currentAddress || !completeAddress(currentAddress)) {
      setError('Complete the street, Region, City or Municipality, Barangay, and postal code before requesting a suggestion.')
      return
    }
    if (!apiKey) {
      setError('Map pinning is not configured. Enter the coordinates manually and confirm the location.')
      return
    }
    setGeocoding(true); setError(null)
    const controller = new AbortController(); requestRef.current = controller
    const parameters = new URLSearchParams({ text: queryFor(currentAddress), filter: 'countrycode:ph', format: 'json', limit: '1', apiKey })
    try {
      const response = await fetch(`https://api.geoapify.com/v1/geocode/search?${parameters}`, { signal: controller.signal })
      if (!response.ok) throw new Error('Geoapify request failed')
      const result = ((await response.json()) as GeocodingResponse).results?.[0]
      if (controller.signal.aborted || requestRef.current !== controller || queryFor(getAddress?.() ?? address!) !== queryFor(currentAddress)) return
      if (!result || !validCoordinates(Number(result.lat), Number(result.lon))) {
        setError('We could not find this address. Keep the entered fields and place the pin manually.')
        return
      }
      onChange({ latitude: Number(result.lat), longitude: Number(result.lon) })
      setError(null)
    } catch (caught) {
      if (!(caught instanceof DOMException && caught.name === 'AbortError')) setError('The location service is unavailable. Your address fields remain unchanged and you can enter coordinates manually.')
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setGeocoding(false) }
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { setError('This browser does not provide location access. Enter coordinates manually or use the map suggestion.'); return }
    const locationAddress = queryFor(getAddress?.() ?? address!)
    setLocating(true); setError(null)
    navigator.geolocation.getCurrentPosition(
      (position) => { if (!mountedRef.current) return; if (queryFor(getAddress?.() ?? address!) !== locationAddress) { setLocating(false); return }; onChange({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocating(false) },
      () => { setError('Location permission was denied or unavailable. Your address fields remain unchanged.'); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const hasPin = latitude !== null && longitude !== null

  return <div className="space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-semibold">Pin the operational hub</p><p className="mt-1 text-xs leading-5 text-zinc-500">The address text remains authoritative. Place the pin at the actual hub entrance, then confirm it.</p></div>
      <div className="flex flex-wrap gap-2">
        <button className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#2563EB] px-3 text-sm font-semibold text-white hover:bg-[#1D4ED8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-55" disabled={geocoding || !apiKey} onClick={() => void suggestLocation()} type="button"><FaLocationDot />{geocoding ? 'Finding…' : hasPin ? 'Suggest again' : 'Pin hub location'}</button>
        <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-55" disabled={locating} onClick={useCurrentLocation} type="button"><FaSatelliteDish />{locating ? 'Locating…' : 'Use device location'}</button>
      </div>
    </div>
    {!apiKey ? <p className="border-l-2 border-amber-500 pl-3 text-xs leading-5 text-amber-800 dark:text-amber-300" role="status">The interactive map is not configured. You can enter coordinates below and confirm the location.</p> : null}
    {error ? <p className="border-l-2 border-[#FF3B30] pl-3 text-xs leading-5 text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
    {hasPin && apiKey ? <LeafletMap apiKey={apiKey} latitude={latitude} longitude={longitude} onChange={onChange} /> : null}
    <AddressPinFields latitude={latitude} longitude={longitude} confirmed={confirmed} accent="blue"
      onChange={onChange} onConfirm={onConfirm} onInvalidate={onInvalidate} />
    <p className="text-xs leading-5 text-zinc-500">Suggestions use Geoapify only when requested. Map attribution: <a className="underline hover:text-[#2563EB] dark:hover:text-blue-300" href="https://www.geoapify.com/" rel="noreferrer" target="_blank">Geoapify</a> · <a className="underline hover:text-[#2563EB] dark:hover:text-blue-300" href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">© OpenStreetMap contributors</a> · <a className="underline hover:text-[#2563EB] dark:hover:text-blue-300" href="https://openmaptiles.org/" rel="noreferrer" target="_blank">© OpenMapTiles</a>.</p>
  </div>
}

function LeafletMap({ apiKey, latitude, longitude, onChange }: { apiKey: string; latitude: number; longitude: number; onChange: (coordinates: HubCoordinates) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const markerRef = useRef<import('leaflet').Marker | null>(null)
  const onChangeRef = useRef(onChange)
  const coordinatesRef = useRef({ latitude, longitude })
  const [mapUnavailable, setMapUnavailable] = useState(false)

  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { coordinatesRef.current = { latitude, longitude } }, [latitude, longitude])
  useEffect(() => {
    if (!containerRef.current || !apiKey) return
    let disposed = false
    void import('leaflet').then((leaflet) => {
      if (disposed || !containerRef.current) return
      const current = coordinatesRef.current
      const map = leaflet.map(containerRef.current, { attributionControl: true, zoomControl: true }).setView([current.latitude, current.longitude], 16)
      const tiles = leaflet.tileLayer(`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(apiKey)}`, {
        maxZoom: 20,
        attribution: 'Powered by <a href="https://www.geoapify.com/">Geoapify</a> | <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a> | <a href="https://openmaptiles.org/">© OpenMapTiles</a>',
      }).addTo(map)
      tiles.on('tileerror', () => setMapUnavailable(true))
      const icon = leaflet.divIcon({ className: '', html: '<span aria-hidden="true" style="display:block;width:24px;height:24px;border:3px solid white;border-radius:50% 50% 50% 0;background:#2563EB;box-shadow:0 2px 6px rgba(35,20,41,.28);transform:rotate(-45deg)"></span>', iconSize: [24, 24], iconAnchor: [12, 24] })
      const marker = leaflet.marker([current.latitude, current.longitude], { draggable: true, icon }).addTo(map)
      marker.on('dragend', () => { const point = marker.getLatLng(); onChangeRef.current({ latitude: point.lat, longitude: point.lng }) })
      map.on('click', (event) => { marker.setLatLng(event.latlng); onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng }) })
      mapRef.current = map; markerRef.current = marker
    }).catch(() => { if (!disposed) setMapUnavailable(true) })
    return () => { disposed = true; markerRef.current?.remove(); markerRef.current = null; mapRef.current?.remove(); mapRef.current = null }
  }, [apiKey])
  useEffect(() => { markerRef.current?.setLatLng([latitude, longitude]); mapRef.current?.panTo([latitude, longitude]) }, [latitude, longitude])

  if (!apiKey || mapUnavailable) return <p className="border-l-2 border-amber-500 px-3 py-2 text-sm leading-5 text-amber-800 dark:text-amber-300" role="status">The interactive map is unavailable. The coordinate draft is retained; use the numeric fields to adjust it.</p>
  return <><div aria-label="Logistics hub location picker" className="h-72 w-full overflow-hidden rounded-md border border-zinc-300 bg-zinc-100 dark:border-white/15 dark:bg-[#111113]" ref={containerRef} role="region" /><p className="mt-2 text-xs leading-5 text-zinc-500">Click the map or drag the pin to the exact hub entrance.</p></>
}
