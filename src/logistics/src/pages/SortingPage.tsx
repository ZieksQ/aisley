import type { IScannerControls } from '@zxing/browser'
import Dexie from 'dexie'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowsRotate, FaBarcode, FaCamera, FaCloudArrowUp, FaPen, FaPlus, FaPowerOff, FaPrint, FaStop, FaTrashCan, FaWarehouse, FaXmark } from 'react-icons/fa6'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { ActionButton, ErrorNotice, PrimaryButton, field, manilaDate, panel } from '../components/PickupUi'
import { ApiError, blob as requestBlob, csrf, request, requestWithTimeout } from '../lib/api'
import { sortingDb, type PendingSortCapture } from '../lib/sortingDb'
import type { SortingBatchResponse, SortingItem, SortingLane, SortingOverview } from '../types/sorting'

const AUTO_SYNC_COUNT = 10
const AUTO_SYNC_MS = 5 * 60 * 1000
const iconButton = 'grid size-9 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white'

function normalizeReference(value: string): string {
  const trimmed = value.trim()
  const qrMatch = trimmed.match(/^AISLEY:WB:\d+:(.+)$/i)
  return (qrMatch?.[1] ?? trimmed).toUpperCase()
}

function destination(item: SortingItem): string {
  return [item.destination.barangay, item.destination.city_municipality, item.destination.province].filter(Boolean).join(', ') || 'Destination area unavailable'
}

function statusTone(status: SortingItem['status']): string {
  if (status === 'sorted') return 'text-emerald-700 dark:text-emerald-300'
  if (status === 'exception') return 'text-amber-700 dark:text-amber-300'
  return 'text-zinc-500'
}

export function SortingPage() {
  const [overview, setOverview] = useState<SortingOverview | null>(null)
  const [captures, setCaptures] = useState<PendingSortCapture[]>([])
  const [selectedLaneId, setSelectedLaneId] = useState('')
  const [manualReference, setManualReference] = useState('')
  const [exceptionCode, setExceptionCode] = useState<PendingSortCapture['exceptionCode']>('damaged')
  const [exceptionReason, setExceptionReason] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [syncBusy, setSyncBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [itemStatus, setItemStatus] = useState('')
  const [editingLane, setEditingLane] = useState<SortingLane | null>(null)
  const [laneCode, setLaneCode] = useState('')
  const [laneName, setLaneName] = useState('')
  const [laneType, setLaneType] = useState<SortingLane['type']>('standard')
  const [lanePosition, setLanePosition] = useState('1')
  const laneDialog = useRef<HTMLDialogElement>(null)
  const helpDialog = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControls = useRef<IScannerControls | null>(null)
  const lastScan = useRef('')
  const lastAutoSyncBatch = useRef('')

  const session = overview?.session ?? null
  const context = overview ? `${overview.context.organization_id}:${overview.context.hub_id}` : ''
  const selectedLane = overview?.lanes.find((lane) => lane.id === selectedLaneId && lane.is_active) ?? null

  const loadCaptures = useCallback(async (contextKey: string, sessionId: string | undefined) => {
    if (!contextKey || !sessionId) { setCaptures([]); return }
    setCaptures(await sortingDb.captures.where({ context: contextKey, sessionId }).sortBy('capturedAt'))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await requestWithTimeout<{ data: SortingOverview }>('/api/v1/logistics/sorting')
      setOverview(result.data)
      const nextContext = `${result.data.context.organization_id}:${result.data.context.hub_id}`
      const stale = await sortingDb.captures.filter((capture) => capture.context !== nextContext).primaryKeys()
      if (stale.length) await sortingDb.captures.bulkDelete(stale)
      await loadCaptures(nextContext, result.data.session?.id)
      setSelectedLaneId((current) => result.data.lanes.some((lane) => lane.id === current && lane.is_active) ? current : '')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sorting data could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [loadCaptures])

  const queueCapture = useCallback(async (raw: string, source: PendingSortCapture['source']) => {
    const reference = normalizeReference(raw)
    if (!overview || !session) { setError('Start a sorting session before scanning parcels.'); return }
    if (!selectedLane) { setError('Select or scan an active sorting lane first.'); return }
    const item = session.items.find((candidate) => [candidate.reference, candidate.order_reference].filter(Boolean).some((value) => value?.toUpperCase() === reference))
    if (!item) { setError(`${reference || 'This parcel'} is not part of the current sorting session.`); return }
    if (item.status === 'sorted') { setError(`${reference} is already sorted.`); return }
    if (selectedLane.type === 'exception' && !exceptionCode) { setError('Choose an exception reason before scanning.'); return }
    if (selectedLane.type === 'exception' && exceptionCode === 'other' && !exceptionReason.trim()) { setError('Describe the sorting exception.'); return }
    try {
      await sortingDb.captures.add({
        id: crypto.randomUUID(), context, sessionId: session.id, laneId: selectedLane.id,
        reference: item.reference, expectedRevision: item.expected_revision, source, capturedAt: new Date().toISOString(),
        exceptionCode: selectedLane.type === 'exception' ? exceptionCode : undefined,
        reason: selectedLane.type === 'exception' && exceptionReason.trim() ? exceptionReason.trim() : undefined,
      })
      setManualReference('')
      setError('')
      setNotice(`${item.reference} saved on this device for ${selectedLane.code}.`)
      await loadCaptures(context, session.id)
    } catch (caught) {
      setError(caught instanceof Dexie.ConstraintError ? `${item.reference} is already waiting to sync.` : 'The sorting capture could not be saved on this device.')
    }
  }, [context, exceptionCode, exceptionReason, loadCaptures, overview, selectedLane, session])

  const handleScan = useCallback((raw: string) => {
    const laneMatch = raw.trim().match(/^AISLEY:SORT-LANE:1:([0-9a-f-]{36})$/i)
    if (laneMatch) {
      const lane = overview?.lanes.find((candidate) => candidate.id.toLowerCase() === laneMatch[1].toLowerCase())
      if (!lane || !lane.is_active) { setError('This sorting lane is unavailable or inactive.'); return }
      setSelectedLaneId(lane.id)
      setError('')
      setNotice(`${lane.code} selected.`)
      return
    }
    void queueCapture(raw, 'barcode')
  }, [overview?.lanes, queueCapture])

  const sync = useCallback(async () => {
    if (!session || !context || !navigator.onLine) return
    const queued = await sortingDb.captures.where({ context, sessionId: session.id }).sortBy('capturedAt')
    if (!queued.length) return
    setSyncBusy(true)
    setError('')
    try {
      await csrf()
      const response = await request<SortingBatchResponse>(`/api/v1/logistics/sorting/sessions/${session.id}/batches`, {
        method: 'POST',
        body: JSON.stringify({ captures: queued.map((capture) => ({
          client_id: capture.id, lane_id: capture.laneId, reference: capture.reference,
          expected_revision: capture.expectedRevision, source: capture.source, captured_at: capture.capturedAt,
          exception_code: capture.exceptionCode, reason: capture.reason,
        })) }),
      })
      const completed = response.data.filter((item) => item.status !== 'failed').map((item) => item.client_id)
      if (completed.length) await sortingDb.captures.bulkDelete(completed)
      for (const failed of response.data.filter((item) => item.status === 'failed')) {
        await sortingDb.captures.update(failed.client_id, { error: failed.message ?? 'The sorting capture was rejected.' })
      }
      setNotice(`${response.summary.sorted} sorted · ${response.summary.exception} exception${response.summary.exception === 1 ? '' : 's'}${response.summary.failed ? ` · ${response.summary.failed} need review` : ''}.`)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Queued captures remain saved offline. Try syncing again when connected.')
      await loadCaptures(context, session.id)
    } finally {
      setSyncBusy(false)
    }
  }, [context, load, loadCaptures, session])

  useEffect(() => { document.title = 'Sorting | Aisley Logistics'; void load() }, [load])
  useEffect(() => {
    const onOnline = () => { setOnline(true); void sync() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const timer = window.setInterval(() => void sync(), AUTO_SYNC_MS)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.clearInterval(timer) }
  }, [sync])
  useEffect(() => {
    if (!online || captures.length < AUTO_SYNC_COUNT || syncBusy) return
    const batch = captures.map((capture) => capture.id).sort().join(':')
    if (batch === lastAutoSyncBatch.current) return
    lastAutoSyncBatch.current = batch
    void sync()
  }, [captures, online, sync, syncBusy])
  useEffect(() => {
    if (!scannerOpen || !videoRef.current) return
    const video = videoRef.current
    let disposed = false
    void import('@zxing/browser').then(({ BrowserMultiFormatReader }) => {
      const reader = new BrowserMultiFormatReader()
      return reader.decodeFromVideoDevice(undefined, video, (result) => {
        if (disposed || !result) return
        const raw = result.getText()
        if (raw === lastScan.current) return
        lastScan.current = raw
        handleScan(raw)
        window.setTimeout(() => { lastScan.current = '' }, 1200)
      })
    }).then((controls) => { scannerControls.current = controls; if (disposed) controls.stop() }).catch((caught: unknown) => {
      setError(caught instanceof DOMException && caught.name === 'NotAllowedError' ? 'Camera permission was denied. Enter the waybill reference manually.' : 'The camera could not start. Enter the waybill reference manually.')
      setScannerOpen(false)
    })
    return () => { disposed = true; scannerControls.current?.stop(); scannerControls.current = null }
  }, [handleScan, scannerOpen])

  async function startSession() {
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request('/api/v1/logistics/sorting/sessions', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({}) })
      setNotice('Sorting session started.')
      await load()
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The sorting session could not be started.') }
    finally { setBusy(false) }
  }

  async function closeSession() {
    if (!session || !window.confirm(`Close ${session.reference}? This session cannot accept more scans.`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      await csrf()
      await request(`/api/v1/logistics/sorting/sessions/${session.id}/close`, { method: 'POST', body: JSON.stringify({ expected_revision: session.revision }) })
      setSelectedLaneId('')
      setNotice('Sorting session closed. Committed parcels are ready for dispatch.')
      await load()
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The sorting session could not be closed.') }
    finally { setBusy(false) }
  }

  function openLaneEditor(lane?: SortingLane) {
    setEditingLane(lane ?? null)
    setLaneCode(lane?.code ?? '')
    setLaneName(lane?.name ?? '')
    setLaneType(lane?.type ?? 'standard')
    setLanePosition(String(lane?.position ?? ((overview?.lanes.length ?? 0) + 1)))
    laneDialog.current?.showModal()
  }

  async function saveLane(event: FormEvent) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await csrf()
      const body = { code: laneCode, name: laneName, type: laneType, position: Number(lanePosition), ...(editingLane ? { expected_revision: editingLane.revision } : {}) }
      await request(editingLane ? `/api/v1/logistics/sorting/lanes/${editingLane.id}` : '/api/v1/logistics/sorting/lanes', { method: editingLane ? 'PATCH' : 'POST', body: JSON.stringify(body) })
      laneDialog.current?.close()
      setNotice(editingLane ? 'Sorting lane updated.' : 'Sorting lane created.')
      await load()
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The sorting lane could not be saved.') }
    finally { setBusy(false) }
  }

  async function toggleLane(lane: SortingLane) {
    if (lane.is_active && !window.confirm(`Deactivate ${lane.code}? It will no longer accept scans.`)) return
    setBusy(true); setError('')
    try {
      await csrf()
      await request(`/api/v1/logistics/sorting/lanes/${lane.id}`, { method: 'PATCH', body: JSON.stringify({ expected_revision: lane.revision, is_active: !lane.is_active }) })
      if (lane.id === selectedLaneId) setSelectedLaneId('')
      await load()
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : 'The sorting lane could not be changed.') }
    finally { setBusy(false) }
  }

  async function openLabel(lane: SortingLane) {
    const popup = window.open('about:blank', '_blank')
    if (!popup) { setError('Allow pop-ups to open the printable lane label.'); return }
    popup.opener = null
    try {
      const asset = await requestBlob(lane.label_url)
      const objectUrl = URL.createObjectURL(asset)
      popup.location.href = objectUrl
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    } catch (caught) {
      popup.close()
      setError(caught instanceof ApiError ? caught.message : 'The lane label could not be opened.')
    }
  }

  const filteredItems = useMemo(() => {
    const term = itemSearch.trim().toLowerCase()
    return (session?.items ?? []).filter((item) => (!itemStatus || item.status === itemStatus) && (!term || [item.reference, item.order_reference, destination(item)].some((value) => value?.toLowerCase().includes(term))))
  }, [itemSearch, itemStatus, session?.items])

  return <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-white/10">
      <div className="flex items-center gap-3"><FaWarehouse className="text-[#4C1268] dark:text-purple-300" aria-hidden="true" /><div><h2 className="text-xl font-semibold">Sorting</h2><p className="text-sm text-zinc-500">Receive → sort lane → dispatch</p></div></div>
      <div className="flex items-center gap-2"><ConnectionStatus online={online} syncing={syncBusy} /><button aria-label="How to use Sorting" className={iconButton} onClick={() => helpDialog.current?.showModal()} title="How to use Sorting" type="button"><span className="text-base font-semibold" aria-hidden="true">?</span></button><button aria-label="Refresh sorting" className={iconButton} disabled={loading} onClick={() => void load()} title="Refresh" type="button"><FaArrowsRotate className={loading ? 'animate-spin' : ''} aria-hidden="true" /></button></div>
    </div>

    {error ? <div className="mt-3"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {notice ? <p className="mt-3 border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}

    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-y border-zinc-200 py-2 text-sm dark:border-white/10">
      <span><strong>{session?.counts.pending ?? 0}</strong> pending</span><span><strong>{session?.counts.sorted ?? 0}</strong> sorted</span><span><strong>{session?.counts.exception ?? 0}</strong> exceptions</span><span><strong>{captures.length}</strong> on this device</span><span><strong>{overview?.waiting_received ?? 0}</strong> next session</span>
    </div>

    <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_23rem]">
      <div className="space-y-3">
        <section className={panel}>
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><div><h3 className="font-semibold">Scanner</h3><p className="text-xs text-zinc-500">{selectedLane ? `${selectedLane.code} · ${selectedLane.name}` : 'Select or scan a lane first'}</p></div><button aria-label={scannerOpen ? 'Stop camera' : 'Start camera'} className={iconButton} onClick={() => setScannerOpen((value) => !value)} title={scannerOpen ? 'Stop camera' : 'Start camera'} type="button">{scannerOpen ? <FaStop aria-hidden="true" /> : <FaCamera aria-hidden="true" />}</button></div>
          {scannerOpen ? <video ref={videoRef} className="max-h-64 w-full bg-black object-contain" muted playsInline /> : <div className="grid min-h-32 place-items-center border-b border-zinc-200 text-center text-sm text-zinc-500 dark:border-white/10"><div><FaBarcode className="mx-auto mb-2 text-2xl" aria-hidden="true" /><p>Scan a lane label, then parcel waybills.</p></div></div>}
          <form className="flex gap-2 p-3" onSubmit={(event) => { event.preventDefault(); void queueCapture(manualReference, 'manual') }}><label className="min-w-0 flex-1"><span className="sr-only">Waybill or Order reference</span><input autoComplete="off" className={field} onChange={(event) => setManualReference(event.target.value)} placeholder="Waybill or Order reference" value={manualReference} /></label><button aria-label="Add manual sorting capture" className={`${iconButton} size-10 border border-zinc-300 dark:border-white/15`} title="Add capture" type="submit"><FaPlus aria-hidden="true" /></button></form>
          {selectedLane?.type === 'exception' ? <div className="grid gap-2 border-t border-zinc-200 px-3 py-2.5 dark:border-white/10 sm:grid-cols-2"><label className="text-xs font-medium">Exception<select className={`${field} mt-1`} onChange={(event) => setExceptionCode(event.target.value as PendingSortCapture['exceptionCode'])} value={exceptionCode}><option value="damaged">Damaged</option><option value="unreadable_label">Unreadable label</option><option value="destination_unclear">Destination unclear</option><option value="other">Other</option></select></label><label className="text-xs font-medium">Reason{exceptionCode === 'other' ? ' *' : ''}<input className={`${field} mt-1`} maxLength={500} onChange={(event) => setExceptionReason(event.target.value)} placeholder="Optional context" value={exceptionReason} /></label></div> : null}
        </section>

        <section className={`${panel} overflow-hidden`}>
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><div><h3 className="font-semibold">Pending on this device ({captures.length})</h3><p className="text-xs text-zinc-500">Syncs at 10 scans, after five minutes, or on reconnect.</p></div><PrimaryButton busy={syncBusy} disabled={!online || captures.length === 0} onClick={() => void sync()}><FaCloudArrowUp aria-hidden="true" />Sync scans</PrimaryButton></div>
          {captures.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{captures.map((capture) => { const lane = overview?.lanes.find((item) => item.id === capture.laneId); return <li className="flex items-start justify-between gap-3 px-3 py-2.5" key={capture.id}><div className="min-w-0"><p className="truncate font-mono text-sm font-medium">{capture.reference}</p><p className="text-xs text-zinc-500">{lane?.code ?? 'Lane unavailable'} · {capture.source === 'barcode' ? 'scanned' : 'manual'} · {manilaDate(capture.capturedAt)}</p>{capture.error ? <p className="mt-1 text-xs text-red-700 dark:text-red-300">{capture.error}</p> : null}</div><button aria-label={`Remove ${capture.reference} from this device`} className={iconButton} onClick={() => void sortingDb.captures.delete(capture.id).then(() => loadCaptures(context, session?.id))} title="Remove local capture" type="button"><FaTrashCan aria-hidden="true" /></button></li> })}</ul> : <p className="px-3 py-5 text-center text-sm text-zinc-500">No captures waiting to sync.</p>}
        </section>
      </div>

      <aside className="space-y-3">
        <section className={panel}>
          <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><h3 className="font-semibold">Session</h3></div>
          <div className="p-3">{session ? <><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-medium">{session.reference}</p><p className="mt-1 text-xs text-zinc-500">Opened {manilaDate(session.opened_at)} · {session.expected_count} expected</p></div><span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Open</span></div><PrimaryButton className="mt-3 w-full" busy={busy} disabled={captures.length > 0 || session.counts.pending > 0 || session.counts.exception > 0} onClick={() => void closeSession()}>Close session</PrimaryButton></> : <><p className="text-sm text-zinc-600 dark:text-zinc-400">{overview?.waiting_received ?? 0} received parcel{overview?.waiting_received === 1 ? '' : 's'} ready. Sessions include up to {overview?.session_limit ?? 100} oldest parcels.</p><PrimaryButton className="mt-3 w-full" busy={busy} disabled={!overview?.lanes.some((lane) => lane.is_active && lane.type === 'standard') || !overview?.waiting_received} onClick={() => void startSession()}>Start session</PrimaryButton></>}</div>
        </section>

        <section className={`${panel} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><h3 className="font-semibold">Lanes</h3><button aria-label="Add sorting lane" className={iconButton} onClick={() => openLaneEditor()} title="Add lane" type="button"><FaPlus aria-hidden="true" /></button></div>
          {overview?.lanes.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{overview.lanes.map((lane) => <li className={`${lane.id === selectedLaneId ? 'bg-purple-50/70 dark:bg-purple-400/10' : ''} flex items-center gap-1`} key={lane.id}><button className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:opacity-45" disabled={!lane.is_active} onClick={() => setSelectedLaneId(lane.id)} type="button"><span className="flex items-center gap-2"><strong className="font-mono text-sm">{lane.code}</strong>{lane.type === 'exception' ? <span className="text-xs text-amber-700 dark:text-amber-300">Exception</span> : null}{!lane.is_active ? <span className="text-xs text-zinc-500">Inactive</span> : null}</span><span className="block truncate text-xs text-zinc-500">{lane.name}</span></button><button aria-label={`Print ${lane.code} label`} className={iconButton} onClick={() => void openLabel(lane)} title="Open printable label" type="button"><FaPrint aria-hidden="true" /></button><button aria-label={`Edit ${lane.code}`} className={iconButton} onClick={() => openLaneEditor(lane)} title="Edit lane" type="button"><FaPen aria-hidden="true" /></button><button aria-label={`${lane.is_active ? 'Deactivate' : 'Activate'} ${lane.code}`} className={iconButton} disabled={busy} onClick={() => void toggleLane(lane)} title={lane.is_active ? 'Deactivate lane' : 'Activate lane'} type="button"><FaPowerOff aria-hidden="true" /></button></li>)}</ul> : <p className="px-3 py-5 text-center text-sm text-zinc-500">Create a standard lane to begin.</p>}
        </section>
      </aside>
    </div>

    {session ? <section className={`${panel} mt-3 overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><h3 className="mr-auto font-semibold">Session reconciliation</h3><label><span className="sr-only">Search session parcels</span><input className={`${field} w-60`} onChange={(event) => setItemSearch(event.target.value)} placeholder="Search reference or area" value={itemSearch} /></label><label><span className="sr-only">Filter session status</span><select className={`${field} w-36`} onChange={(event) => setItemStatus(event.target.value)} value={itemStatus}><option value="">All statuses</option><option value="pending">Pending</option><option value="sorted">Sorted</option><option value="exception">Exception</option></select></label></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]"><tr><th className="px-3 py-2 font-medium">Parcel</th><th className="px-3 py-2 font-medium">Destination</th><th className="px-3 py-2 font-medium">Lane</th><th className="px-3 py-2 font-medium">Status</th></tr></thead><tbody className="divide-y divide-zinc-200 dark:divide-white/10">{filteredItems.map((item) => { const lane = overview?.lanes.find((candidate) => candidate.id === item.lane_id); return <tr key={item.id}><td className="px-3 py-2"><p className="font-mono font-medium">{item.reference}</p><p className="text-xs text-zinc-500">{item.order_reference}</p></td><td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{destination(item)}</td><td className="px-3 py-2 font-mono text-xs">{lane?.code ?? '—'}</td><td className={`px-3 py-2 capitalize ${statusTone(item.status)}`}><p className="font-medium">{item.status}</p>{item.exception_code ? <p className="text-xs">{item.exception_code.replaceAll('_', ' ')}{item.exception_reason ? ` · ${item.exception_reason}` : ''}</p> : null}</td></tr> })}</tbody></table>{!filteredItems.length ? <p className="px-3 py-5 text-center text-sm text-zinc-500">No session parcels match the filters.</p> : null}</div>
    </section> : null}

    <dialog className="m-auto w-[min(92vw,34rem)] border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={helpDialog}>
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">How to use Sorting</h3><button aria-label="Close sorting instructions" className={iconButton} onClick={() => helpDialog.current?.close()} title="Close" type="button"><FaXmark aria-hidden="true" /></button></div>
      <ol className="list-decimal space-y-3 px-5 py-4 pl-10 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <li>Create at least one standard lane. Add an exception lane if parcels may need review, then print and place the lane labels.</li>
        <li>Start a session. It loads up to 100 of the oldest parcels already received at this hub.</li>
        <li>Scan a lane label or select a lane from the list before scanning parcel waybills.</li>
        <li>Scan each parcel or enter its reference manually. Offline captures stay saved on this device.</li>
        <li>Use <strong>Sync scans</strong> when needed. Captures also sync at 10 scans, after five minutes, or when the connection returns.</li>
        <li>Move exceptions to a standard lane after review, reconcile every parcel, then close the session.</li>
      </ol>
      <div className="flex justify-end border-t border-zinc-200 px-4 py-3 dark:border-white/10"><PrimaryButton onClick={() => helpDialog.current?.close()} type="button">Got it</PrimaryButton></div>
    </dialog>

    <dialog className="m-auto w-[min(92vw,30rem)] border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={laneDialog}>
      <form onSubmit={(event) => void saveLane(event)}><div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">{editingLane ? 'Edit lane' : 'Add lane'}</h3><button aria-label="Close lane form" className={iconButton} onClick={() => laneDialog.current?.close()} title="Close" type="button"><FaXmark aria-hidden="true" /></button></div><div className="grid gap-3 p-4 sm:grid-cols-2"><label className="text-sm font-medium">Code<input autoFocus className={`${field} mt-1 uppercase`} maxLength={24} onChange={(event) => setLaneCode(event.target.value)} placeholder="NCR-01" required value={laneCode} /></label><label className="text-sm font-medium">Position<input className={`${field} mt-1`} min="1" max="999" onChange={(event) => setLanePosition(event.target.value)} required type="number" value={lanePosition} /></label><label className="text-sm font-medium sm:col-span-2">Name<input className={`${field} mt-1`} maxLength={80} onChange={(event) => setLaneName(event.target.value)} placeholder="NCR staging lane" required value={laneName} /></label><label className="text-sm font-medium sm:col-span-2">Type<select className={`${field} mt-1`} onChange={(event) => setLaneType(event.target.value as SortingLane['type'])} value={laneType}><option value="standard">Standard — marks parcel sorted</option><option value="exception">Exception — holds parcel for review</option></select></label></div><div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-white/10"><ActionButton onClick={() => laneDialog.current?.close()} type="button">Cancel</ActionButton><PrimaryButton busy={busy} type="submit">Save lane</PrimaryButton></div></form>
    </dialog>
  </div>
}
