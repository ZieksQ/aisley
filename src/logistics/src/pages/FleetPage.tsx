import { useCallback, useEffect, useState } from 'react'
import { ActionButton, ErrorNotice, PrimaryButton, field, panel } from '../components/PickupUi'
import { csrf, requestWithTimeout } from '../lib/api'

type Truck = { id: string; plate_number: string; make: string | null; model: string | null; max_parcels: number; reserved_or_onboard_parcels: number; remaining_capacity: number; is_active: boolean; availability: string; revision: number; last_confirmed_hub: { name: string } | null; active_trip: { driver: string; from_hub: string; to_hub: string; parcel_count: number } | null }
type Driver = { courier_id: string; name: string; email: string; can_drive_company_truck: boolean; revision: number }

export function FleetPage() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [form, setForm] = useState({ plate_number: '', make: '', model: '', max_parcels: '100' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    try { const response = await requestWithTimeout<{ data: { trucks: Truck[]; drivers: Driver[] } }>('/api/v1/logistics/fleet'); setTrucks(response.data.trucks); setDrivers(response.data.drivers) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Fleet data could not be loaded.') }
  }, [])
  useEffect(() => { document.title = 'Company fleet | Aisley Logistics'; void load() }, [load])

  async function createTruck() {
    setBusy(true); setError(''); setNotice('')
    try { await csrf(); await requestWithTimeout('/api/v1/logistics/fleet/trucks', { method: 'POST', body: JSON.stringify({ ...form, make: form.make || null, model: form.model || null, max_parcels: Number(form.max_parcels) }) }); setForm({ plate_number: '', make: '', model: '', max_parcels: '100' }); setNotice('Company truck registered.'); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The truck could not be registered.') }
    finally { setBusy(false) }
  }
  async function toggleTruck(truck: Truck) {
    setBusy(true); setError('')
    try { await csrf(); await requestWithTimeout(`/api/v1/logistics/fleet/trucks/${truck.id}`, { method: 'PATCH', body: JSON.stringify({ expected_revision: truck.revision, is_active: !truck.is_active }) }); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The truck could not be updated.') }
    finally { setBusy(false) }
  }
  async function editTruck(truck: Truck) {
    const plate = window.prompt('Plate number', truck.plate_number)
    if (plate === null || !plate.trim()) return
    const capacity = window.prompt('Maximum parcels', String(truck.max_parcels))
    if (capacity === null || !Number.isInteger(Number(capacity)) || Number(capacity) < 1) return
    const make = window.prompt('Make (optional)', truck.make ?? '')
    if (make === null) return
    const model = window.prompt('Model (optional)', truck.model ?? '')
    if (model === null) return
    setBusy(true); setError('')
    try { await csrf(); await requestWithTimeout(`/api/v1/logistics/fleet/trucks/${truck.id}`, { method: 'PATCH', body: JSON.stringify({ expected_revision: truck.revision, plate_number: plate.trim(), max_parcels: Number(capacity), make: make.trim() || null, model: model.trim() || null }) }); setNotice('Company truck updated.'); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The truck could not be updated.') }
    finally { setBusy(false) }
  }
  async function toggleDriver(driver: Driver) {
    setBusy(true); setError('')
    try { await csrf(); await requestWithTimeout(`/api/v1/logistics/fleet/drivers/${driver.courier_id}`, { method: 'PATCH', body: JSON.stringify({ expected_revision: driver.revision, can_drive_company_truck: !driver.can_drive_company_truck }) }); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Driver capability could not be updated.') }
    finally { setBusy(false) }
  }

  return <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-white/10"><div><h2 className="text-xl font-semibold">Company fleet</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Register company-owned trucks and authorize approved Couriers to drive them.</p></div><ActionButton onClick={() => void load()}>Refresh</ActionButton></div>
    {error ? <div className="mt-3"><ErrorNotice message={error} /></div> : null}{notice ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p> : null}
    <div className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className={`${panel} overflow-hidden`}><div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">Trucks</h3></div>{trucks.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-white/[0.03]"><tr><th className="px-4 py-3">Truck</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Current work</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody>{trucks.map((truck) => <tr className="border-t border-zinc-200 dark:border-white/10" key={truck.id}><td className="px-4 py-3"><p className="font-mono font-medium">{truck.plate_number}</p><p className="text-xs text-zinc-500">{[truck.make, truck.model].filter(Boolean).join(' ') || 'Make/model not set'} · {truck.availability.replaceAll('_', ' ')}</p></td><td className="px-4 py-3">{truck.last_confirmed_hub?.name ?? 'In transit'}</td><td className="px-4 py-3">{truck.reserved_or_onboard_parcels}/{truck.max_parcels}<p className="text-xs text-zinc-500">{truck.remaining_capacity} remaining</p></td><td className="px-4 py-3">{truck.active_trip ? <><p>{truck.active_trip.from_hub} → {truck.active_trip.to_hub}</p><p className="text-xs text-zinc-500">{truck.active_trip.driver}</p></> : 'None'}</td><td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><ActionButton disabled={busy} onClick={() => void editTruck(truck)}>Edit</ActionButton><ActionButton disabled={busy} onClick={() => void toggleTruck(truck)}>{truck.is_active ? 'Deactivate' : 'Activate'}</ActionButton></div></td></tr>)}</tbody></table></div> : <p className="p-4 text-sm text-zinc-500">No company trucks registered.</p>}</section>
      <section className={`${panel} p-4`}><h3 className="font-semibold">Register truck</h3><div className="mt-3 space-y-3"><label className="block text-sm font-medium">Plate number<input className={`${field} mt-1`} maxLength={64} value={form.plate_number} onChange={(event) => setForm({ ...form, plate_number: event.target.value })} /></label><div className="grid grid-cols-2 gap-2"><label className="text-sm font-medium">Make<input className={`${field} mt-1`} value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} /></label><label className="text-sm font-medium">Model<input className={`${field} mt-1`} value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label></div><label className="block text-sm font-medium">Maximum parcels<input className={`${field} mt-1`} min="1" max="10000" type="number" value={form.max_parcels} onChange={(event) => setForm({ ...form, max_parcels: event.target.value })} /></label><PrimaryButton className="w-full" busy={busy} disabled={!form.plate_number.trim() || Number(form.max_parcels) < 1} onClick={() => void createTruck()}>Register truck</PrimaryButton></div></section>
    </div>
    <section className={`${panel} mt-3 overflow-hidden`}><div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">Truck drivers</h3><p className="mt-1 text-xs text-zinc-500">Only approved, active Couriers explicitly enabled here can be assigned a company truck.</p></div>{drivers.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{drivers.map((driver) => <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" key={driver.courier_id}><div><p className="font-medium">{driver.name}</p><p className="text-xs text-zinc-500">{driver.email}</p></div><label className="flex items-center gap-2 text-sm"><input checked={driver.can_drive_company_truck} className="size-4 accent-[#4C1268]" disabled={busy} onChange={() => void toggleDriver(driver)} type="checkbox" />Can drive company trucks</label></li>)}</ul> : <p className="p-4 text-sm text-zinc-500">No approved Couriers are available.</p>}</section>
  </div>
}
