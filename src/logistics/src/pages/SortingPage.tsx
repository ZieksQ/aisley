import { ParcelLaneMove } from '../components/ParcelLaneMove'
import type { IScannerControls } from '@zxing/browser'
import Dexie from 'dexie'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaArrowsRotate, FaBarcode, FaCamera, FaCloudArrowUp, FaPlus, FaPrint, FaStop, FaTrashCan, FaWarehouse, FaXmark } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { ErrorNotice, PrimaryButton, field, manilaDate, panel } from '../components/PickupUi'
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
  const [autoRoute, setAutoRoute] = useState(true)
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
  const helpDialog = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControls = useRef<IScannerControls | null>(null)
  const lastScan = useRef('')
  const lastAutoSyncBatch = useRef('')

  const session = overview?.session ?? null
  const context = overview ? `${overview.context.organization_id}:${overview.context.hub_id}` : ''
  const selectedLane = overview?.lanes.find((lane) => lane.id === selectedLaneId && lane.is_active) ?? null
  const scannerMode = autoRoute
    ? (overview?.automatic_sorting.active_plan ? 'Plan routing active' : 'Plan routing · exception fallback')
    : (selectedLane ? selectedLane.code + ' · ' + selectedLane.name : 'Select an active lane')

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
    const item = session.items.find((candidate) => [candidate.tracking_id, candidate.reference, candidate.order_reference].filter(Boolean).some((value) => value?.toUpperCase() === reference))
    if (!item) { setError((reference || 'This parcel') + ' is not part of the current sorting session.'); return }
    if (item.status === 'sorted') { setError(reference + ' is already sorted.'); return }
    const targetLane = autoRoute ? (item.automatic_routing.lane ?? overview.automatic_sorting.exception_lane) : selectedLane
    if (!targetLane) {
      setError(autoRoute ? 'Create an active exception lane or map this destination in an active sort plan.' : 'Select or scan an active sorting lane first.')
      return
    }
    if (!autoRoute && targetLane.type === 'exception' && !exceptionCode) { setError('Choose an exception reason before scanning.'); return }
    if (!autoRoute && targetLane.type === 'exception' && exceptionCode === 'other' && !exceptionReason.trim()) { setError('Describe the sorting exception.'); return }
    try {
      await sortingDb.captures.add({
        id: crypto.randomUUID(), context, sessionId: session.id, laneId: targetLane.id, autoRoute,
        reference: item.reference, expectedRevision: item.expected_revision, source, capturedAt: new Date().toISOString(),
        exceptionCode: !autoRoute && targetLane.type === 'exception' ? exceptionCode : undefined,
        reason: !autoRoute && targetLane.type === 'exception' && exceptionReason.trim() ? exceptionReason.trim() : undefined,
      })
      setManualReference('')
      setError('')
      setNotice(autoRoute ? item.reference + ' saved for automatic routing on this device.' : item.reference + ' saved on this device for ' + targetLane.code + '.')
      await loadCaptures(context, session.id)
    } catch (caught) {
      setError(caught instanceof Dexie.ConstraintError ? item.reference + ' is already waiting to sync.' : 'The sorting capture could not be saved on this device.')
    }
  }, [autoRoute, context, exceptionCode, exceptionReason, loadCaptures, overview, selectedLane, session])

  const handleScan = useCallback((raw: string) => {
    const laneMatch = raw.trim().match(/^AISLEY:SORT-LANE:1:([0-9a-f-]{36})$/i)
    if (laneMatch) {
      const lane = overview?.lanes.find((candidate) => candidate.id.toLowerCase() === laneMatch[1].toLowerCase())
      if (!lane || !lane.is_active) { setError('This sorting lane is unavailable or inactive.'); return }
      setSelectedLaneId(lane.id)
      setAutoRoute(false)
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
          client_id: capture.id, lane_id: capture.laneId, auto_route: capture.autoRoute ?? false, reference: capture.reference,
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
    void import('../lib/waybillScanner').then(({ createWaybillReader, waybillCameraConstraints }) => {
      if (disposed) return
      const reader = createWaybillReader()
      return reader.decodeFromConstraints(waybillCameraConstraints, video, (result) => {
        if (disposed || !result) return
        const raw = result.getText()
        if (raw === lastScan.current) return
        lastScan.current = raw
        handleScan(raw)
        window.setTimeout(() => { lastScan.current = '' }, 1200)
      })
    }).then((controls) => { if (!controls) return; scannerControls.current = controls; if (disposed) controls.stop() }).catch((caught: unknown) => {
      if (disposed) return
      setError(caught instanceof DOMException && caught.name === 'NotAllowedError' ? 'Camera permission was denied. Enter the tracking ID manually.' : 'The camera could not start. Enter the tracking ID manually.')
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
    return (session?.items ?? []).filter((item) => (!itemStatus || item.status === itemStatus) && (!term || [item.tracking_id, item.reference, item.order_reference, destination(item)].some((value) => value?.toLowerCase().includes(term))))
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><div><h3 className="font-semibold">Scanner</h3><p className="text-xs text-zinc-500">{scannerMode}</p></div><div className="flex flex-wrap items-center gap-2"><button className="h-9 border border-zinc-300 px-2 text-xs font-medium hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/10" onClick={() => setAutoRoute((value) => !value)} type="button">{autoRoute ? 'Use manual lane' : 'Use plan routing'}</button><button aria-label={scannerOpen ? 'Stop camera' : 'Start camera'} className={iconButton} onClick={() => setScannerOpen((value) => !value)} title={scannerOpen ? 'Stop camera' : 'Start camera'} type="button">{scannerOpen ? <FaStop aria-hidden="true" /> : <FaCamera aria-hidden="true" />}</button></div></div>
          {scannerOpen ? <div><video ref={videoRef} className="max-h-64 w-full bg-black object-contain" muted playsInline /><p className="px-3 py-2 text-xs text-zinc-500">Keep all bars and both white margins visible. QR codes are ignored.</p></div> : <div className="grid min-h-32 place-items-center border-b border-zinc-200 px-3 text-center text-sm text-zinc-500 dark:border-white/10"><div><FaBarcode className="mx-auto mb-2 text-2xl" aria-hidden="true" /><p>{autoRoute ? 'Scan thin 1D Code 128 tracking barcodes for automatic lane routing.' : 'Scan a Code 128 lane label, then thin tracking barcodes.'}</p></div></div>}
          <form className="flex gap-2 p-3" onSubmit={(event) => { event.preventDefault(); void queueCapture(manualReference, 'manual') }}><label className="min-w-0 flex-1"><span className="sr-only">Tracking ID or waybill reference</span><input autoComplete="off" className={field} onChange={(event) => setManualReference(event.target.value)} placeholder="Tracking ID or waybill reference" value={manualReference} /></label><button aria-label="Add manual sorting capture" className={iconButton + ' size-10 border border-zinc-300 dark:border-white/15'} title="Add capture" type="submit"><FaPlus aria-hidden="true" /></button></form>
          {!autoRoute && selectedLane?.type === 'exception' ? <div className="grid gap-2 border-t border-zinc-200 px-3 py-2.5 dark:border-white/10 sm:grid-cols-2"><label className="text-xs font-medium">Exception<select className={field + ' mt-1'} onChange={(event) => setExceptionCode(event.target.value as PendingSortCapture['exceptionCode'])} value={exceptionCode}><option value="damaged">Damaged</option><option value="unreadable_label">Unreadable label</option><option value="destination_unclear">Destination unclear</option><option value="other">Other</option></select></label><label className="text-xs font-medium">Reason{exceptionCode === 'other' ? ' *' : ''}<input className={field + ' mt-1'} maxLength={500} onChange={(event) => setExceptionReason(event.target.value)} placeholder="Optional context" value={exceptionReason} /></label></div> : null}
        </section>

        <section className={`${panel} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><div><h3 className="font-semibold">Pending on this device ({captures.length})</h3><p className="text-xs text-zinc-500">Syncs at 10 scans, after five minutes, or on reconnect.</p></div><PrimaryButton busy={syncBusy} disabled={!online || captures.length === 0} onClick={() => void sync()}><FaCloudArrowUp aria-hidden="true" />Sync scans</PrimaryButton></div>
          {captures.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{captures.map((capture) => { const lane = overview?.lanes.find((item) => item.id === capture.laneId); const laneLabel = (capture.autoRoute ?? false) ? (lane ? 'Plan target · ' + lane.code : 'Plan routing') : (lane?.code ?? 'Lane unavailable'); return <li className="flex items-start justify-between gap-3 px-3 py-2.5" key={capture.id}><div className="min-w-0"><p className="truncate font-mono text-sm font-medium">{capture.reference}</p><p className="text-xs text-zinc-500">{laneLabel} · {capture.source === 'barcode' ? 'scanned' : 'manual'} · {manilaDate(capture.capturedAt)}</p>{capture.error ? <p className="mt-1 text-xs text-red-700 dark:text-red-300">{capture.error}</p> : null}</div><button aria-label={'Remove ' + capture.reference + ' from this device'} className={iconButton} onClick={() => void sortingDb.captures.delete(capture.id).then(() => loadCaptures(context, session?.id))} title="Remove local capture" type="button"><FaTrashCan aria-hidden="true" /></button></li> })}</ul> : <p className="px-3 py-5 text-center text-sm text-zinc-500">No captures waiting to sync.</p>}
        </section>
      </div>

      <aside className="space-y-3">
        <section className={panel}>
          <div className="border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><h3 className="font-semibold">Session</h3></div>
          <div className="p-3">{session ? <><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-medium">{session.reference}</p><p className="mt-1 text-xs text-zinc-500">Opened {manilaDate(session.opened_at)} · {session.expected_count} expected</p></div><span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Open</span></div><PrimaryButton className="mt-3 w-full" busy={busy} disabled={captures.length > 0 || session.counts.pending > 0 || session.counts.exception > 0} onClick={() => void closeSession()}>Close session</PrimaryButton></> : <><p className="text-sm text-zinc-600 dark:text-zinc-400">{overview?.waiting_received ?? 0} received parcel{overview?.waiting_received === 1 ? '' : 's'} ready. Sessions include up to {overview?.session_limit ?? 100} oldest parcels.</p><PrimaryButton className="mt-3 w-full" busy={busy} disabled={!overview?.lanes.some((lane) => lane.is_active && lane.type === 'standard') || !overview?.waiting_received} onClick={() => void startSession()}>Start session</PrimaryButton></>}</div>
        </section>

        <section className={panel}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><h3 className="font-semibold">Lanes</h3><Link className="text-xs font-medium text-[#4C1268] underline-offset-4 hover:underline dark:text-purple-300" to="/sort-plan">Manage sort plan</Link></div>
          {overview?.lanes.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{overview.lanes.map((lane) => <li className={(lane.id === selectedLaneId ? 'bg-purple-50/70 dark:bg-purple-400/10 ' : '') + 'flex items-center gap-1'} key={lane.id}><button className="min-w-0 flex-1 px-3 py-2.5 text-left disabled:opacity-45" disabled={!lane.is_active} onClick={() => { setSelectedLaneId(lane.id); setAutoRoute(false) }} type="button"><span className="flex items-center gap-2"><strong className="font-mono text-sm">{lane.code}</strong>{lane.type === 'exception' ? <span className="text-xs text-amber-700 dark:text-amber-300">Exception</span> : null}{!lane.is_active ? <span className="text-xs text-zinc-500">Inactive</span> : null}</span><span className="block truncate text-xs text-zinc-500">{lane.name}</span></button><button aria-label={'Print ' + lane.code + ' label'} className={iconButton} onClick={() => void openLabel(lane)} title="Open printable label" type="button"><FaPrint aria-hidden="true" /></button></li>)}</ul> : <p className="px-3 py-5 text-center text-sm text-zinc-500">Create lanes in Sort plan.</p>}
        </section>
      </aside>
    </div>

    {session ? <section className={`${panel} mt-3 overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-white/10"><h3 className="mr-auto font-semibold">Session reconciliation</h3><label className="w-full min-w-0 sm:w-auto"><span className="sr-only">Search session parcels</span><input className={`${field} max-w-full sm:w-60`} onChange={(event) => setItemSearch(event.target.value)} placeholder="Search reference or area" value={itemSearch} /></label><label><span className="sr-only">Filter session status</span><select className={`${field} w-36`} onChange={(event) => setItemStatus(event.target.value)} value={itemStatus}><option value="">All statuses</option><option value="pending">Pending</option><option value="sorted">Sorted</option><option value="exception">Exception</option></select></label></div>
      <ul className="divide-y divide-zinc-200 dark:divide-white/10">{filteredItems.map((item) => {
        const lane = overview?.lanes.find((candidate) => candidate.id === item.lane_id)
        return <li key={item.id} className="grid min-w-0 gap-2 p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-center">
          <div className="min-w-0"><p className="break-all font-mono text-sm font-medium">{item.reference}</p><p className="break-all text-xs text-zinc-500">{item.order_reference}</p></div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{destination(item)}</p>
          <div><p className="text-xs"><span className="md:sr-only">Lane: </span>{lane?.code ?? 'Unassigned'}</p><p className="text-xs text-zinc-500">Auto: {item.automatic_routing.lane?.code ?? 'Exception fallback'}</p>{item.can_move ? <ParcelLaneMove shipmentId={item.shipment_id} revision={item.shipment_revision} laneId={item.lane_id} lanes={overview?.lanes ?? []} disabled={syncBusy || busy || captures.some((capture) => capture.reference === item.reference)} onMoved={load} /> : null}</div>
          <div className={`text-sm ${statusTone(item.status)}`}><p className="font-medium capitalize">{item.status}</p>{item.exception_code ? <p className="text-xs">{item.exception_code.replaceAll('_', ' ')}{item.exception_reason ? ` · ${item.exception_reason}` : ''}</p> : null}</div>
        </li>
      })}</ul>{!filteredItems.length ? <p className="px-3 py-5 text-center text-sm text-zinc-500">No session parcels match the filters.</p> : null}

    </section> : null}

    <dialog className="m-auto max-h-[90dvh] w-[min(92vw,34rem)] overflow-y-auto border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" ref={helpDialog}>
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">How to use Sorting</h3><button aria-label="Close sorting instructions" className={iconButton} onClick={() => helpDialog.current?.close()} title="Close" type="button"><FaXmark aria-hidden="true" /></button></div>
      <ol className="list-decimal space-y-3 px-5 py-4 pl-10 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <li>Create an active standard lane, an active exception lane, and an active Sort plan with exact postal-code mappings. Print and place the lane labels from the Sort plan page.</li>
        <li>Start a session. It loads up to 100 of the oldest parcels already received at this hub.</li>
        <li>Leave <strong>Use plan routing</strong> enabled for normal work. Scan each parcel tracking ID or enter it manually; the server checks the buyer postal code and chooses the mapped lane.</li>
        <li>If the plan is missing, the postal code is unmapped, or a mapped lane is unavailable, the parcel goes to the exception lane and stays received at hub. Scan a lane label or choose a lane only for a deliberate manual override.</li>
        <li>Use <strong>Sync scans</strong> when needed. Captures also sync at 10 scans, after five minutes, or when the connection returns.</li>
        <li>Resolve exceptions by scanning into a standard lane. Use Move lane to relocate an already sorted parcel before dispatch.</li><li>Dispatch ready parcels by source lane, even while the session is open. Close the session once all parcels are reconciled and local scans are synced.</li>
      </ol>
      <div className="flex justify-end border-t border-zinc-200 px-4 py-3 dark:border-white/10"><PrimaryButton onClick={() => helpDialog.current?.close()} type="button">Got it</PrimaryButton></div>
    </dialog>

  </div>
}
