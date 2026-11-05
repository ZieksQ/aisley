'use client'

import { useEffect, useId, useState } from 'react'

export type Coordinates = { latitude: number; longitude: number }

export function validPin(latitude: unknown, longitude: unknown): boolean {
  return !(typeof latitude === 'string' && !latitude.trim())
    && !(typeof longitude === 'string' && !longitude.trim())
    && latitude !== null && latitude !== undefined && latitude !== ''
    && longitude !== null && longitude !== undefined && longitude !== ''
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180
}

/** Keyboard-accessible coordinate entry and explicit confirmation for map candidates. */
export function AddressPinFields({ latitude, longitude, confirmed, onChange, onConfirm, onInvalidate, accent = 'purple' }: {
  latitude: number | null
  longitude: number | null
  confirmed: boolean
  onChange: (coordinates: Coordinates) => void
  onConfirm: () => void
  onInvalidate: () => void
  accent?: 'purple' | 'blue'
}) {
  const id = useId()
  const [lat, setLat] = useState(latitude === null ? '' : String(latitude))
  const [lon, setLon] = useState(longitude === null ? '' : String(longitude))
  const [error, setError] = useState('')
  useEffect(() => {
    setLat(latitude === null ? '' : String(latitude))
    setLon(longitude === null ? '' : String(longitude))
    setError('')
  }, [latitude, longitude])

  function confirm() {
    if (!validPin(lat.trim(), lon.trim())) {
      setError('Enter latitude from -90 to 90 and longitude from -180 to 180.')
      return
    }
    onChange({ latitude: Number(lat), longitude: Number(lon) })
    onConfirm()
    setError('')
  }

  const inputClass = 'mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 dark:border-white/20 dark:bg-zinc-900 dark:text-white'
  return (
    <fieldset className="mt-4 space-y-3">
      <legend className="text-sm font-semibold">Confirm the exact location</legend>
      <p className="text-xs leading-5">Review the map pin or enter coordinates manually if the map is unavailable, then confirm the location.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor={`${id}-latitude`} className="text-sm">Latitude
          <input id={`${id}-latitude`} className={inputClass} inputMode="decimal" value={lat} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => { setLat(event.target.value); onInvalidate() }} />
        </label>
        <label htmlFor={`${id}-longitude`} className="text-sm">Longitude
          <input id={`${id}-longitude`} className={inputClass} inputMode="decimal" value={lon} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => { setLon(event.target.value); onInvalidate() }} />
        </label>
      </div>
      {error ? <p id={`${id}-error`} role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <button type="button" onClick={confirm} className={`min-h-11 rounded-md border px-4 text-sm font-semibold ${accent === 'blue' ? 'border-[#2563EB] text-[#1E40AF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:text-[#93C5FD]' : 'border-[#4C1268] text-[#4C1268] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:text-[#C4B5FD]'}`}>
        {confirmed ? 'Location confirmed' : 'Confirm location'}
      </button>
      <p role="status" className="text-xs">{confirmed ? 'This location will be saved with the address.' : 'Confirm the location before using this address for delivery or pickup.'}</p>
    </fieldset>
  )
}
