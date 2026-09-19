import { useCallback, useEffect, useState } from 'react'
import { ActionButton, field } from './PickupUi'
import { ApiError, csrf, requestWithTimeout } from '../lib/api'
import { CompactPagination, COMPACT_PAGE_SIZE } from './CompactPagination'

type Area = { postal_code: string; is_active: boolean; revision: number }

export function SupportedPostalCodes({ onChange }: { onChange?: (codes: string[]) => void }) {
  const [areas, setAreas] = useState<Area[]>([])
  const [postal, setPostal] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const load = useCallback(async () => {
    try {
      const result = await requestWithTimeout<{ data: { service_areas: Area[] } }>('/api/v1/logistics/linehaul')
      setAreas(result.data.service_areas)
      onChange?.(result.data.service_areas.filter((area) => area.is_active).map((area) => area.postal_code))
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'Supported postal codes could not be loaded.') }
  }, [onChange])
  useEffect(() => { void load() }, [load])

  async function update(code: string, active: boolean, revision?: number) {
    if (!active && !window.confirm('Remove support for ' + code + '? Existing plan mappings remain. Review future scans for routing exceptions.')) return
    setBusy(true); setError('')
    try {
      await csrf()
      await requestWithTimeout('/api/v1/logistics/linehaul/service-areas', { method: 'PUT', body: JSON.stringify({ postal_code: code, is_active: active, expected_revision: revision }) })
      setPostal('')
      await load()
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The postal code could not be updated.') }
    finally { setBusy(false) }
  }

  const active = areas.filter((area) => area.is_active).sort((a, b) => a.postal_code.localeCompare(b.postal_code))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(active.length / COMPACT_PAGE_SIZE)))
  return <section className="border border-zinc-200 dark:border-white/10">
    <div className="border-b border-zinc-200 px-3 py-2 dark:border-white/10"><h4 className="font-semibold">Supported postal codes</h4></div>
    <form className="flex flex-wrap items-end gap-2 p-2" onSubmit={(event) => { event.preventDefault(); const existing = areas.find((area) => area.postal_code === postal); void update(postal, true, existing?.revision) }}>
      <label className="min-w-36 flex-1 text-xs font-medium">Postal code<input className={field + ' mt-1 font-mono'} inputMode="numeric" maxLength={4} pattern="\d{4}" required value={postal} onChange={(event) => setPostal(event.target.value)} /></label>
      <ActionButton disabled={busy || active.some((area) => area.postal_code === postal)} type="submit">Add code</ActionButton>
    </form>
    {error ? <p className="px-3 pb-2 text-sm text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
    {active.length ? <ul className="divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-white/10 dark:border-white/10">{active.slice((currentPage - 1) * COMPACT_PAGE_SIZE, currentPage * COMPACT_PAGE_SIZE).map((area) => <li className="flex items-center justify-between px-3 py-1 text-sm" key={area.postal_code}><span className="font-mono">{area.postal_code}</span><button aria-label={'Remove support for ' + area.postal_code} className="px-2 py-1 text-xs text-red-700 hover:underline disabled:opacity-40 dark:text-red-300" disabled={busy} onClick={() => void update(area.postal_code, false, area.revision)} type="button">Remove</button></li>)}</ul> : <p className="px-3 pb-3 text-sm text-zinc-500">No supported postal codes.</p>}
    <CompactPagination label="Supported postal codes" page={currentPage} total={active.length} onPageChange={setPage} />
  </section>
}
