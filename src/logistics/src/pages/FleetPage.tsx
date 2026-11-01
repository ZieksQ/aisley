import { useCallback, useEffect, useRef, useState } from 'react'
import { LuPlus, LuRefreshCw } from 'react-icons/lu'
import { Link, useNavigate } from 'react-router-dom'
import { ConfirmationDialog, PortalButton, PortalSkeleton, PortalState } from '@aisley/ui/portal'
import { useAuth } from '../auth/useAuth'
import { changeDriverCapability, changeTruckState, loadFleet, saveTruck } from '../features/fleet/api'
import { FleetDrivers, FleetTrucks } from '../features/fleet/FleetTables'
import { FleetTruckForm } from '../features/fleet/FleetTruckForm'
import type { Driver, Truck, TruckInput } from '../features/fleet/types'
import { ApiError } from '../lib/api'

export function FleetPage() {
  const { logistics, logout } = useAuth()
  const navigate = useNavigate()
  const loadId = useRef(0)
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<Truck | 'new' | null>(null)
  const [changing, setChanging] = useState<Truck | null>(null)

  const handleAccess = useCallback(async (caught: unknown) => {
    if (!(caught instanceof ApiError)) return
    if (caught.status === 401) {
      await logout().catch(() => undefined)
      navigate('/login', { replace: true })
    } else if (caught.status === 403 && caught.code === 'POLICY_CONSENT_REQUIRED') navigate('/policy-consent', { replace: true })
  }, [logout, navigate])

  const load = useCallback(async () => {
    const id = ++loadId.current
    setLoading(true)
    setError('')
    try {
      const response = await loadFleet()
      if (id !== loadId.current) return
      setTrucks(response.data.trucks)
      setDrivers(response.data.drivers)
      setLoaded(true)
    } catch (caught) {
      if (id !== loadId.current) return
      await handleAccess(caught)
      setLoaded(false)
      setError(caught instanceof Error ? caught.message : 'Fleet data could not be loaded.')
    } finally { if (id === loadId.current) setLoading(false) }
  }, [handleAccess, logistics?.id])

  useEffect(() => {
    document.title = 'Company fleet | Aisley Logistics'
    setLoaded(false)
    setTrucks([])
    setDrivers([])
    setForm(null)
    void load()
    return () => { loadId.current += 1 }
  }, [load])

  async function save(input: TruckInput, truck?: Truck) {
    setBusy(true)
    setNotice('')
    try {
      await saveTruck(input, truck)
      setNotice(truck ? 'Company truck updated.' : 'Company truck registered.')
      await load()
    } catch (caught) {
      await handleAccess(caught)
      throw caught
    } finally { setBusy(false) }
  }

  async function mutate(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setChanging(null)
      setNotice(success)
      await load()
    } catch (caught) {
      await handleAccess(caught)
      setChanging(null)
      setError(caught instanceof Error ? caught.message : 'The change could not be saved. Refresh before trying again.')
    } finally { setBusy(false) }
  }

  return <div className="portal-page space-y-6">
    <header className="portal-page-header">
      <div>
        <h2 className="portal-page-heading">Company fleet</h2>
        <p className="portal-page-description">Manage company-owned trucks, monitor parcel capacity, and authorize approved Couriers to drive them.</p>
      </div>
      <div className="portal-inline-actions">
        <PortalButton isLoading={loading} disabled={busy} onClick={() => void load()}>
          <LuRefreshCw aria-hidden="true" />
          Refresh
        </PortalButton>
        <PortalButton variant="primary" disabled={busy || loading || !loaded} onClick={() => setForm('new')}>
          <LuPlus aria-hidden="true" />
          Register truck
        </PortalButton>
      </div>
    </header>
    {notice ? <p className="portal-feedback" role="status">{notice}</p> : null}
    {error ? <PortalState
      error
      title="Fleet request failed"
      description={error}
      action={<PortalButton disabled={busy} onClick={() => void load()}>
        Refresh fleet
      </PortalButton>} /> : null}
    {loading && !loaded ? <PortalSkeleton label="Loading company fleet" /> : loaded ? <>
      <section className="space-y-4" aria-labelledby="fleet-trucks-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="fleet-trucks-title" className="text-lg font-semibold">Company trucks</h3>
            <p className="portal-page-description">Current location, reservations, and remaining capacity.</p>
          </div>
          <span className="portal-tag portal-tag-brand">{trucks.length} truck{trucks.length === 1 ? '' : 's'}</span>
        </div>
        <FleetTrucks trucks={trucks} busy={busy} onEdit={setForm} onToggle={setChanging} />
      </section>
      <section className="space-y-4" aria-labelledby="fleet-drivers-title">
        <div>
          <h3 id="fleet-drivers-title" className="text-lg font-semibold">Truck drivers</h3>
          <p className="portal-page-description">Only approved, active Couriers with this capability enabled can be assigned a company truck. The server checks current work before saving changes.</p>
        </div>
        <FleetDrivers
          drivers={drivers}
          busy={busy}
          onToggle={(driver) => void mutate(() => changeDriverCapability(driver), 'Driver capability updated.')} />
      </section>
      <p className="portal-secondary text-sm">For Courier-owned personal vehicles and their documents, open <Link className="portal-link underline" to="/vehicles">
        Vehicles
      </Link>.</p>
    </> : null}
    {form ? <FleetTruckForm truck={form === 'new' ? undefined : form} onSave={save} onClose={() => setForm(null)} /> : null}
    {changing ? <ConfirmationDialog
      title={`${changing.is_active ? 'Deactivate' : 'Activate'} ${changing.plate_number}?`}
      confirmLabel={changing.is_active ? 'Deactivate truck' : 'Activate truck'}
      busy={busy}
      onClose={() => setChanging(null)}
      onConfirm={() => void mutate(() => changeTruckState(changing), 'Truck availability updated.')}>
      <p>{changing.is_active ? 'This truck will be unavailable for new assignments. Current work and reservations remain subject to server checks.' : 'This truck will be active for eligible assignments. Location, availability, and capacity checks still apply.'}</p>
    </ConfirmationDialog> : null}
  </div>
}
