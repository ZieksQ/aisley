import { useRef, useState } from 'react'
import { ApiError } from '../lib/api'
import { confirmLinehaulAction } from './api'
import type { LinehaulAction } from './api'
import type { LinehaulTrip } from './types'

export function useLinehaulTripAction(trip: LinehaulTrip, token: string, onUpdated: (trip: LinehaulTrip) => void, onBusyChange: (busy: boolean) => void) {
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const submitting = useRef(false)
  const pending = useRef<{ action: LinehaulAction; revision: number } | null>(null)
  const action: LinehaulAction | null = trip.courier_can_depart ? 'depart' : trip.courier_can_report_arrival ? 'arrival' : null

  async function submit() {
    if (!action || !confirmed || submitting.current || stale) return
    submitting.current = true
    setBusy(true)
    onBusyChange(true)
    setError(null)
    setNotice(null)
    const attempt = pending.current ?? { action, revision: trip.revision }
    pending.current = attempt
    try {
      const updated = await confirmLinehaulAction(trip.id, attempt.action, attempt.revision, token)
      pending.current = null
      setConfirmed(false)
      onUpdated(updated)
      setNotice(attempt.action === 'depart' ? 'Departure recorded. Your trip is in transfer.' : 'Arrival reported. Wait for Logistics to confirm receipt and unloading.')
    } catch (caught) {
      const definiteFailure = caught instanceof ApiError && caught.status < 500
      if (definiteFailure) {
        pending.current = null
        setStale(true)
        setConfirmed(false)
      }
      setError(`${caught instanceof ApiError ? caught.message : 'The response could not be confirmed.'} ${definiteFailure ? 'Refresh transfers before trying again.' : 'Retry the same confirmation to check whether it was recorded.'}`)
    } finally {
      submitting.current = false
      setBusy(false)
      onBusyChange(false)
    }
  }

  return { confirmed, setConfirmed, busy, error, notice, stale, action, retrying: pending.current !== null, submit }
}
