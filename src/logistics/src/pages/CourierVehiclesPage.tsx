import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowsRotate, FaMagnifyingGlass, FaTruck } from 'react-icons/fa6'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ActionButton, ErrorNotice, link, panel } from '../components/PickupUi'
import { ApiError, requestWithTimeout } from '../lib/api'
import type { CourierVehiclePageResponse, CourierVehicleSummary } from '../types/vehicles'

function listError(caught: unknown): string {
  if (!navigator.onLine) return 'You appear to be offline. Reconnect and try again.'
  if (caught instanceof ApiError) {
    if (caught.status === 403) return 'You do not have access to this vehicle list.'
    if (caught.status === 408) return 'The request timed out. Check your connection and try again.'
    return caught.message
  }
  return 'We could not load vehicles. Check your connection and try again.'
}

function VehicleRow({ item }: { item: CourierVehicleSummary }) {
  const destination = `/couriers/${item.courier.id}/vehicle`
  const documents = [item.vehicle.official_receipt_uploaded ? 'OR uploaded' : 'OR missing', item.vehicle.certificate_of_registration_uploaded ? 'CR uploaded' : 'CR missing'].join(' · ')

  return <tr className="border-t border-zinc-200 dark:border-white/10"><td className="px-4 py-3"><p className="font-medium">{item.courier.name}</p><p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{item.courier.email}</p></td><td className="px-4 py-3 font-mono text-sm">{item.vehicle.plate_number}</td><td className="px-4 py-3 text-sm capitalize">{item.vehicle.vehicle_type}</td><td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{documents}</td><td className="px-4 py-3 text-right"><Link className={link} to={destination}>View vehicle<span className="sr-only"> for {item.courier.name}</span></Link></td></tr>
}

export function CourierVehiclesPage() {
  const { logistics, logout } = useAuth()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const [query, setQuery] = useState(search)
  const [result, setResult] = useState<{ scope: string; page: CourierVehiclePageResponse } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const scope = JSON.stringify([logistics?.id, page, search, refresh])
  const current = result && result.scope === scope ? result.page : null

  useEffect(() => { setQuery(search) }, [search])

  useEffect(() => {
    document.title = 'Vehicles | Aisley Logistics'
    let active = true
    setResult(null)
    setLoading(true)
    setError('')
    const queryString = new URLSearchParams({ page: String(page), per_page: '20' })
    if (search) queryString.set('search', search)
    requestWithTimeout<CourierVehiclePageResponse>(`/api/v1/logistics/vehicles?${queryString.toString()}`)
      .then((response) => { if (active) setResult({ scope, page: response }) })
      .catch(async (caught: unknown) => {
        if (!active) return
        if (caught instanceof ApiError && caught.status === 401) {
          await logout().catch(() => undefined)
          if (active) navigate('/login', { replace: true })
          return
        }
        if (caught instanceof ApiError && caught.status === 403 && caught.code === 'POLICY_CONSENT_REQUIRED') {
          navigate('/policy-consent', { replace: true })
          return
        }
        setError(listError(caught))
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [logout, navigate, page, scope, search])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = new URLSearchParams(params)
    const term = query.trim()
    if (term) next.set('search', term)
    else next.delete('search')
    next.delete('page')
    setParams(next)
  }

  function movePage(nextPage: number) {
    const next = new URLSearchParams(params)
    next.set('page', String(nextPage))
    setParams(next)
  }

  return <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10"><div><h2 className="text-xl font-semibold">Vehicles</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Current vehicles for approved Couriers in your organization.</p></div><ActionButton busy={loading} onClick={() => setRefresh((value) => value + 1)}><FaArrowsRotate aria-hidden="true" />Refresh</ActionButton></div>
    <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch} role="search"><label className="sr-only" htmlFor="vehicle-search">Search vehicles</label><div className="relative min-w-0 flex-1"><FaMagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" /><input className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#4C1268] focus:ring-2 focus:ring-[#4C1268]/15 dark:border-white/15 dark:bg-[#111113] dark:focus:border-purple-400" id="vehicle-search" maxLength={100} onChange={(event) => setQuery(event.target.value)} placeholder="Search by Courier, email, or plate" value={query} /></div><button className="h-10 rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3d0e54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]" type="submit">Search</button></form>
    {loading ? <p className={`${panel} mt-4 p-4 text-sm text-zinc-600 dark:text-zinc-400`} role="status">Loading vehicles…</p> : null}
    {error ? <div className="mt-4"><ErrorNotice message={error} retry={() => setRefresh((value) => value + 1)} /></div> : null}
    {!loading && !error && current?.data.length === 0 ? <div className={`${panel} mt-4 p-6 text-center`}><FaTruck aria-hidden="true" className="mx-auto text-xl text-zinc-400" /><p className="mt-3 font-medium">{search ? 'No vehicles match your search.' : 'No approved Courier vehicles yet.'}</p><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{search ? 'Try another Courier name, email, or plate.' : 'Vehicles appear here after Courier approval.'}</p></div> : null}
    {current && current.data.length > 0 ? <section className={`${panel} mt-4 overflow-hidden`} aria-label="Courier vehicles"><div className="hidden overflow-x-auto md:block"><table className="w-full text-left"><caption className="sr-only">Approved Courier vehicles</caption><thead className="bg-zinc-50 text-xs font-medium text-zinc-600 dark:bg-white/[0.03] dark:text-zinc-400"><tr><th className="px-4 py-3" scope="col">Courier</th><th className="px-4 py-3" scope="col">Plate</th><th className="px-4 py-3" scope="col">Type</th><th className="px-4 py-3" scope="col">Documents</th><th className="px-4 py-3 text-right" scope="col">Action</th></tr></thead><tbody>{current.data.map((item) => <VehicleRow item={item} key={item.vehicle.id} />)}</tbody></table></div><ul className="divide-y divide-zinc-200 dark:divide-white/10 md:hidden">{current.data.map((item) => <li className="p-4" key={item.vehicle.id}><p className="font-medium">{item.courier.name}</p><p className="mt-1 break-all text-xs text-zinc-600 dark:text-zinc-400">{item.courier.email}</p><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><div><dt className="text-xs text-zinc-600 dark:text-zinc-400">Plate</dt><dd className="mt-1 font-mono">{item.vehicle.plate_number}</dd></div><div><dt className="text-xs text-zinc-600 dark:text-zinc-400">Type</dt><dd className="mt-1 capitalize">{item.vehicle.vehicle_type}</dd></div></dl><p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">{item.vehicle.official_receipt_uploaded ? 'OR uploaded' : 'OR missing'} · {item.vehicle.certificate_of_registration_uploaded ? 'CR uploaded' : 'CR missing'}</p><Link className={`${link} mt-3 inline-block text-sm`} to={`/couriers/${item.courier.id}/vehicle`}>View vehicle</Link></li>)}</ul>{current.meta.last_page > 1 ? <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3 text-sm dark:border-white/10"><ActionButton disabled={current.meta.current_page <= 1} onClick={() => movePage(current.meta.current_page - 1)}>Previous</ActionButton><span className="text-xs text-zinc-600 dark:text-zinc-400">Page {current.meta.current_page} of {current.meta.last_page}</span><ActionButton disabled={current.meta.current_page >= current.meta.last_page} onClick={() => movePage(current.meta.current_page + 1)}>Next</ActionButton></div> : null}</section> : null}
    {current ? <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400" aria-live="polite">{current.meta.total} vehicle{current.meta.total === 1 ? '' : 's'} found</p> : null}
  </div>
}
