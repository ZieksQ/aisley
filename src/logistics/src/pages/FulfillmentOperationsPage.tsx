import type { IScannerControls } from '@zxing/browser'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowsRotate, FaBarcode, FaCamera, FaClipboardCheck, FaMagnifyingGlass, FaRoute, FaStop, FaTruckFast, FaWarehouse } from 'react-icons/fa6'
import { Link, useSearchParams } from 'react-router-dom'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { ActionButton, ErrorNotice, PrimaryButton, field, panel } from '../components/PickupUi'
import { useAuth } from '../auth/useAuth'
import { ApiError, csrf, request, requestWithTimeout } from '../lib/api'
import { decodeParcelBarcode, normalizeParcelReference, type DecodedParcelBarcode } from '../lib/parcelBarcode'
import { cacheParcels, findCachedParcel, readCachedQueue } from '../lib/parcelSearchDb'
import type { FulfillmentCompletionIntent, FulfillmentEvidence, FulfillmentQueueResponse, FulfillmentRecordResponse, FulfillmentShipment, FulfillmentTask } from '../types/fulfillment'

const ONLINE_PAGE_SIZE = 10
const iconButton = 'grid size-9 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white'

const transitionLabels: Record<string, string> = {
  sorted_at_hub: 'Mark sorted at hub',
  picked_up_from_hub: 'Validate hub pickup',
  in_transit: 'Record in transit',
  out_for_delivery: 'Mark out for delivery',
  delivered: 'Validate delivery',
}

const statusOptions = [
  'picked_up_from_seller',
  'received_at_hub',
  'sorted_at_hub',
  'dispatched_from_hub',
  'delivery_assigned',
  'delivery_accepted',
  'picked_up_from_hub',
  'in_transit',
  'out_for_delivery',
  'delivered',
]

const evidenceOptions = ['submitted', 'awaiting_validation', 'validated', 'rejected']

function human(value: string): string {
  return value.replaceAll('_', ' ')
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))
}

function stateTone(value: string): string {
  if (value === 'delivered' || value === 'validated' || value === 'accepted') return 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200'
  if (value === 'rejected') return 'border-red-300 bg-red-50 text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200'
  if (value === 'awaiting_validation' || value === 'submitted') return 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200'
  return 'border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-300'
}

function StateLabel({ value }: { value: string }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium capitalize ${stateTone(value)}`}>{human(value)}</span>
}

function referenceFor(record: FulfillmentShipment): string {
  return record.parcel?.waybill_reference ?? record.parcel?.order_reference ?? record.parcel?.reference ?? ''
}

function canUseOffline(caught: unknown): boolean {
  if (!navigator.onLine) return true
  if (!(caught instanceof ApiError)) return true
  return caught.status === 0 || caught.status === 408 || caught.status >= 500
}

function validEvidence(task: FulfillmentTask | null, purpose: string): FulfillmentEvidence[] {
  return (task?.evidence ?? []).filter((item) => item.purpose === purpose && item.status !== 'rejected' && item.status !== 'unavailable')
}

function completionFor(task: FulfillmentTask | null, evidenceId: string | undefined): FulfillmentCompletionIntent | null {
  return task?.completion_intents?.find((intent) => intent.evidence_id === evidenceId) ?? null
}

export function FulfillmentOperationsPage() {
  const { logistics } = useAuth()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('search') ?? '')
  const [status, setStatus] = useState(params.get('status') ?? '')
  const [evidenceStatus, setEvidenceStatus] = useState(params.get('evidence_status') ?? '')
  const [queue, setQueue] = useState<FulfillmentQueueResponse | null>(null)
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState('')
  const [reference, setReference] = useState(params.get('reference') ?? '')
  const [record, setRecord] = useState<FulfillmentShipment | null>(null)
  const [recordSource, setRecordSource] = useState<'authoritative' | 'offline-cache' | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [notice, setNotice] = useState('')
  const [queueNotice, setQueueNotice] = useState('')
  const [reason, setReason] = useState('')
  const [transitionBusy, setTransitionBusy] = useState(false)
  const [evidenceChoice, setEvidenceChoice] = useState<Record<string, string>>({})
  const [scannerOpen, setScannerOpen] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const [decodedParcel, setDecodedParcel] = useState<DecodedParcelBarcode | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerControls = useRef<IScannerControls | null>(null)
  const lastScan = useRef('')

  const context = logistics?.organization?.hub ? `${logistics.organization.id}:${logistics.organization.hub.id}` : ''
  const parsedPage = Number(params.get('page') ?? '1')
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const appliedSearch = params.get('search') ?? ''
  const appliedStatus = params.get('status') ?? ''
  const appliedEvidenceStatus = params.get('evidence_status') ?? ''

  const loadQueue = useCallback(async () => {
    setQueueLoading(true)
    setQueueError('')
    setQueueNotice('')
    const query = new URLSearchParams({ per_page: String(ONLINE_PAGE_SIZE), page: String(page) })
    if (appliedSearch.trim()) query.set('search', appliedSearch.trim())
    if (appliedStatus) query.set('status', appliedStatus)
    if (appliedEvidenceStatus) query.set('evidence_status', appliedEvidenceStatus)
    try {
      if (!navigator.onLine) {
        const cached = await readCachedQueue(context, appliedSearch, appliedStatus, appliedEvidenceStatus, page, ONLINE_PAGE_SIZE)
        if (cached) {
          setQueue(cached)
          setQueueNotice('Offline: showing cached parcel results. Current server status may have changed.')
        } else {
          setQueue(null)
          setQueueError('No parcel results are cached on this device. Connect to load the Logistics queue.')
        }
        return
      }

      const result = await requestWithTimeout<FulfillmentQueueResponse>(`/api/v1/logistics/dashboard/queue?${query.toString()}`)
      setQueue(result)
      void cacheParcels(context, result.data).catch(() => undefined)
    } catch (caught) {
      if (canUseOffline(caught) && context) {
        const cached = await readCachedQueue(context, appliedSearch, appliedStatus, appliedEvidenceStatus, page, ONLINE_PAGE_SIZE).catch(() => null)
        if (cached) {
          setQueue(cached)
          setQueueNotice('Offline: showing cached parcel results. Current server status may have changed.')
          return
        }
      }
      setQueueError(caught instanceof ApiError ? caught.message : 'The operational queue could not be loaded.')
    } finally {
      setQueueLoading(false)
    }
  }, [appliedEvidenceStatus, appliedSearch, appliedStatus, context, page])

  const loadRecord = useCallback(async (value: string, decoded?: DecodedParcelBarcode) => {
    const decodedValue = decoded ?? decodeParcelBarcode(value)
    const nextReference = decodedValue.reference ?? normalizeParcelReference(value)
    if (!nextReference) {
      setDetailError('This barcode does not contain a usable waybill, Order, Parcel, or shipment reference.')
      return
    }
    setDecodedParcel(decoded || decodedValue.format !== 'reference' ? decodedValue : null)
    setDetailLoading(true)
    setDetailError('')
    setNotice('')
    setRecord(null)
    setRecordSource(null)
    try {
      if (!navigator.onLine) {
        const cached = await findCachedParcel(context, nextReference).catch(() => null)
        if (cached) {
          setRecord(cached.record)
          setRecordSource('offline-cache')
          setReference(nextReference)
          setParams((current) => { const next = new URLSearchParams(current); next.set('reference', nextReference); return next }, { replace: true })
          setNotice('Offline: showing the last cached parcel details. Custody status must be confirmed online before acting.')
        } else setDetailError('The barcode was decoded locally, but no cached parcel details are available. Connect to query the current status.')
        return
      }
      const result = await requestWithTimeout<FulfillmentRecordResponse>(`/api/v1/logistics/update-status/records/${encodeURIComponent(nextReference)}`)
      setRecord(result.data)
      setRecordSource('authoritative')
      setReference(nextReference)
      void cacheParcels(context, [result.data], true).catch(() => undefined)
      setParams((current) => { const next = new URLSearchParams(current); next.set('reference', nextReference); return next }, { replace: true })
    } catch (caught) {
      if (canUseOffline(caught) && context) {
        const cached = await findCachedParcel(context, nextReference).catch(() => null)
        if (cached) {
          setRecord(cached.record)
          setRecordSource('offline-cache')
          setReference(nextReference)
          setParams((current) => { const next = new URLSearchParams(current); next.set('reference', nextReference); return next }, { replace: true })
          setNotice('Offline: showing the last cached parcel details. Custody status must be confirmed online before acting.')
          return
        }
        setRecord(null)
        setRecordSource(null)
        setDetailError('The barcode was decoded locally, but no cached parcel details are available. Connect to query the current status.')
        return
      }
      setRecord(null)
      setRecordSource(null)
      setDetailError(caught instanceof ApiError ? caught.message : 'The fulfillment record could not be loaded.')
    } finally {
      setDetailLoading(false)
    }
  }, [context, setParams])

  const handleScan = useCallback((raw: string) => {
    const decoded = decodeParcelBarcode(raw)
    setDecodedParcel(decoded)
    if (!decoded.reference) {
      setDetailError('Barcode decoded, but it does not contain a usable parcel reference.')
      return
    }
    setReference(decoded.reference)
    void loadRecord(decoded.reference, decoded)
  }, [loadRecord])

  useEffect(() => { document.title = 'Parcel search | Aisley Logistics'; void loadQueue() }, [loadQueue])
  useEffect(() => {
    const initialReference = params.get('reference')
    if (initialReference && !record && !detailLoading) void loadRecord(initialReference)
  }, [detailLoading, loadRecord, params, record])
  useEffect(() => {
    setEvidenceChoice({})
  }, [record?.shipment_id])
  useEffect(() => {
    const onOnline = () => { setOnline(true); void loadQueue() }
    const onOffline = () => { setOnline(false); setQueueNotice('Offline: parcel search is limited to records cached on this device.') }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [loadQueue])
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
      if (disposed) return
      setDetailError(caught instanceof DOMException && caught.name === 'NotAllowedError' ? 'Camera permission was denied. Enter the parcel reference manually.' : 'The camera could not start. Enter the parcel reference manually.')
      setScannerOpen(false)
    })
    return () => { disposed = true; scannerControls.current?.stop(); scannerControls.current = null }
  }, [handleScan, scannerOpen])

  const finalTask = useMemo(() => record?.tasks.find((task) => task.leg === 'final_mile') ?? null, [record])

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('page')
      if (search.trim()) next.set('search', search.trim()); else next.delete('search')
      if (status) next.set('status', status); else next.delete('status')
      if (evidenceStatus) next.set('evidence_status', evidenceStatus); else next.delete('evidence_status')
      return next
    })
  }

  function openRecord(item: FulfillmentShipment) {
    const nextReference = referenceFor(item)
    if (nextReference) void loadRecord(nextReference)
    else setDetailError('This queue row does not have a usable waybill or Order reference.')
  }

  async function transition(target: string, evidenceId?: string) {
    if (!record || !reference || recordSource !== 'authoritative' || !online) {
      setDetailError('This parcel view is read-only until an authoritative online record is loaded.')
      return
    }
    if (!window.confirm(`${transitionLabels[target] ?? human(target)} for ${reference}? The server will validate the current state and evidence.`)) return
    setTransitionBusy(true)
    setDetailError('')
    setNotice('')
    const payload: Record<string, unknown> = { reference, target_state: target, expected_revision: record.revision }
    if (evidenceId) payload.evidence_id = evidenceId
    if (reason.trim()) payload.reason = reason.trim()
    try {
      await csrf()
      const result = await request<FulfillmentRecordResponse & { event_id: string }>('/api/v1/logistics/update-status/transitions', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(payload) })
      setRecord(result.data)
      setReason('')
      setNotice(`${transitionLabels[target] ?? human(target)} committed. The response is the authoritative custody projection.`)
      await loadQueue()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setDetailError('The record changed in another session. Reloading the latest authoritative state.')
        await loadRecord(reference)
      } else setDetailError(caught instanceof ApiError ? caught.message : 'The transition could not be completed.')
    } finally {
      setTransitionBusy(false)
    }
  }

  const summary = queue?.summary
  const currentReference = record ? referenceFor(record) || reference : reference
  const actionsEnabled = recordSource === 'authoritative' && online && !detailLoading
  const noticeClass = notice.startsWith('Offline')
    ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200'
    : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200'

  return <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-5 lg:px-6">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-4 dark:border-white/10">
      <div><div className="flex items-center gap-3"><FaWarehouse className="text-[#4C1268] dark:text-purple-300" aria-hidden="true" /><h2 className="text-xl font-semibold">Parcel search</h2></div><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Find parcels in this Logistics organization and review their custody, task, and evidence details.</p></div>
      <div className="flex items-center gap-3"><ConnectionStatus online={online} syncing={queueLoading || detailLoading} offlineLabel="Offline — cached parcels only" /><button aria-label={queueLoading ? 'Refreshing parcel queue' : 'Refresh parcel queue'} aria-busy={queueLoading} className={iconButton} disabled={queueLoading} onClick={() => void loadQueue()} title="Refresh parcel queue" type="button"><FaArrowsRotate className={queueLoading ? 'animate-spin' : ''} aria-hidden="true" /></button></div>
    </div>

    {summary ? <dl className="mt-4 grid gap-3 border-b border-zinc-200 pb-4 text-sm dark:border-white/10 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-zinc-500">Active shipments</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{summary.total}</dd></div><div><dt className="text-zinc-500">Evidence awaiting validation</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{summary.pending_evidence}</dd></div><div><dt className="text-zinc-500">Completion intents</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{summary.pending_completion}</dd></div><div><dt className="text-zinc-500">Out for delivery</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{summary.by_status.out_for_delivery ?? 0}</dd></div></dl> : null}

    <form className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_15rem_15rem_auto]" onSubmit={applyFilters}>
      <label className="relative"><span className="sr-only">Search a waybill, Order, or Parcel reference</span><FaMagnifyingGlass className="pointer-events-none absolute left-3 top-3 text-zinc-400" aria-hidden="true" /><input className={`${field} pl-9`} onChange={(event) => setSearch(event.target.value)} placeholder="Waybill, Order, or Parcel reference" value={search} /></label>
      <label><span className="sr-only">Filter by shipment state</span><select className={field} onChange={(event) => setStatus(event.target.value)} value={status}><option value="">All custody states</option>{statusOptions.map((option) => <option key={option} value={option}>{human(option)}</option>)}</select></label>
      <label><span className="sr-only">Filter by evidence status</span><select className={field} onChange={(event) => setEvidenceStatus(event.target.value)} value={evidenceStatus}><option value="">All evidence states</option>{evidenceOptions.map((option) => <option key={option} value={option}>{human(option)}</option>)}</select></label>
      <ActionButton type="submit">Apply filters</ActionButton>
    </form>

    {queueError ? <div className="mt-4"><ErrorNotice message={queueError} retry={() => void loadQueue()} /></div> : null}
    {queueNotice ? <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200" role="status">{queueNotice}</p> : null}
    {notice ? <p className={`mt-4 border p-3 text-sm ${noticeClass}`} role="status">{notice}</p> : null}

    <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(19rem,24rem)_minmax(0,1fr)]">
      <section className={`${panel} overflow-hidden`} aria-label="Parcel results" aria-busy={queueLoading}>
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10"><div><h3 className="font-semibold">Parcels</h3><p className="mt-1 text-xs text-zinc-500">Only shared records already created for this hub appear here.</p></div><FaTruckFast className="text-zinc-400" aria-hidden="true" /></div>
        {queueLoading && !queue ? <p className="p-4 text-sm" role="status">Loading operational records…</p> : queue?.data.length ? <ul className="divide-y divide-zinc-200 dark:divide-white/10">{queue.data.map((item) => { const itemReference = referenceFor(item); const final = item.tasks.find((task) => task.leg === 'final_mile'); return <li key={item.shipment_id}><button className={`block w-full px-4 py-3 text-left hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#4C1268] dark:hover:bg-white/[0.04] ${itemReference === currentReference ? 'bg-purple-50/70 dark:bg-purple-400/10' : ''}`} onClick={() => openRecord(item)} type="button"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{item.parcel?.order_reference ?? item.parcel?.reference ?? 'Shipment'}</p><p className="mt-1 truncate font-mono text-xs text-zinc-500">{item.parcel?.waybill_reference ?? item.parcel?.reference ?? item.shipment_id.slice(0, 8)}</p></div><StateLabel value={item.status} /></div><div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500"><span>{final ? `Final mile: ${human(final.status)}` : 'Hub processing'}</span><span>{formatDate(item.last_activity_at)}</span></div></button></li> })}</ul> : <div className="p-4 text-sm text-zinc-600 dark:text-zinc-400"><p>{queue?.freshness.state === 'offline-cache' ? 'No cached parcel results match these filters.' : queue ? 'No authoritative records match these filters.' : 'No operational records are available.'}</p><p className="mt-2 text-xs text-zinc-500">A missing row is not treated as a zero or as an uncreated shipment.</p></div>}
        {queue && queue.meta.last_page > 1 ? <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm dark:border-white/10"><button className="font-medium text-[#4C1268] disabled:opacity-40 dark:text-purple-300" disabled={page <= 1} onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.set('page', String(page - 1)); return next })} type="button">Previous</button><span className="text-xs text-zinc-500">Page {page} of {queue.meta.last_page}</span><button className="font-medium text-[#4C1268] disabled:opacity-40 dark:text-purple-300" disabled={page >= queue.meta.last_page} onClick={() => setParams((current) => { const next = new URLSearchParams(current); next.set('page', String(page + 1)); return next })} type="button">Next</button></div> : null}
      </section>

      <section className={`${panel} min-h-[32rem]`} aria-label="Fulfillment record detail" aria-busy={detailLoading}>
        <div className="border-b border-zinc-200 px-4 py-3 dark:border-white/10"><h3 className="font-semibold">Reference lookup</h3><form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void loadRecord(reference) }}><label className="flex-1"><span className="sr-only">Waybill, Order, Parcel, or shipment reference</span><input className={field} onChange={(event) => setReference(event.target.value)} placeholder="Waybill, Order, Parcel, or shipment reference" value={reference} autoComplete="off" /></label><div className="flex gap-2"><button aria-label={scannerOpen ? 'Stop barcode scanner' : 'Start barcode scanner'} aria-pressed={scannerOpen} className={iconButton} onClick={() => setScannerOpen((value) => !value)} title={scannerOpen ? 'Stop barcode scanner' : 'Start barcode scanner'} type="button">{scannerOpen ? <FaStop aria-hidden="true" /> : <FaCamera aria-hidden="true" />}</button><PrimaryButton busy={detailLoading} type="submit">Look up</PrimaryButton></div></form>{scannerOpen ? <div className="mt-3 overflow-hidden border border-zinc-200 bg-black dark:border-white/10"><video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline /><p className="bg-zinc-950 px-3 py-2 text-xs text-zinc-300">Point the camera at a Code 128 barcode or Aisley waybill QR.</p></div> : null}{decodedParcel ? <DecodedParcelSummary decoded={decodedParcel} /> : null}</div>
        {detailError ? <div className="m-4"><ErrorNotice message={detailError} retry={() => void loadRecord(reference)} /></div> : null}
        {detailLoading && !record ? <p className="p-5 text-sm" role="status">Loading the authoritative record…</p> : record ? <><div className="px-4 pt-4 sm:px-5">{recordSource === 'offline-cache' ? <p className="border-l-2 border-amber-500 pl-3 text-xs leading-5 text-amber-800 dark:text-amber-300" role="status">Cached projection only. This record is read-only until the current server state is loaded.</p> : null}</div><RecordDetail actionsEnabled={actionsEnabled} record={record} reason={reason} setReason={setReason} evidenceChoice={evidenceChoice} setEvidenceChoice={setEvidenceChoice} transitionBusy={transitionBusy} onTransition={(target, evidenceId) => void transition(target, evidenceId)} finalTask={finalTask} /></> : <div className="grid min-h-[24rem] place-items-center p-6 text-center text-sm text-zinc-500"><div><FaClipboardCheck className="mx-auto mb-3 text-2xl text-zinc-400" aria-hidden="true" /><p>Choose a queue row or enter a reference to inspect a shipment.</p><p className="mt-1 text-xs">Transitions and evidence decisions always come from the server.</p></div></div>}
      </section>
    </div>
  </div>
}

function DecodedParcelSummary({ decoded }: { decoded: DecodedParcelBarcode }) {
  const format = decoded.format === 'aisley-waybill-qr' ? 'Aisley waybill QR' : decoded.format === 'aisley-parcel-qr' ? 'Aisley parcel QR' : decoded.format === 'structured' ? 'Structured barcode data' : 'Reference barcode'
  return <div className="mt-3 border-l-2 border-[#4C1268] bg-purple-50/70 px-3 py-2 text-sm dark:border-purple-400 dark:bg-purple-400/10" role="status"><div className="flex items-start gap-2"><FaBarcode className="mt-0.5 shrink-0 text-[#4C1268] dark:text-purple-300" aria-hidden="true" /><div className="min-w-0"><p className="font-medium">Barcode decoded locally</p><p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{format}. Encoded fields are informational; the online record is authoritative for current custody and status.</p><dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2"><div><dt className="text-zinc-500">Lookup reference</dt><dd className="truncate font-mono">{decoded.reference ?? 'Not present'}</dd></div>{decoded.waybillReference ? <div><dt className="text-zinc-500">Waybill</dt><dd className="truncate font-mono">{decoded.waybillReference}</dd></div> : null}{decoded.orderReference ? <div><dt className="text-zinc-500">Order</dt><dd className="truncate font-mono">{decoded.orderReference}</dd></div> : null}{decoded.parcelReference ? <div><dt className="text-zinc-500">Parcel</dt><dd className="truncate font-mono">{decoded.parcelReference}</dd></div> : null}{decoded.parcelId ? <div><dt className="text-zinc-500">Parcel ID</dt><dd className="truncate font-mono">{decoded.parcelId}</dd></div> : null}{decoded.shipmentId ? <div><dt className="text-zinc-500">Shipment ID</dt><dd className="truncate font-mono">{decoded.shipmentId}</dd></div> : null}{decoded.status ? <div><dt className="text-zinc-500">Encoded status (unverified)</dt><dd className="capitalize">{human(decoded.status)}</dd></div> : null}{decoded.itemCount !== null ? <div><dt className="text-zinc-500">Encoded item count</dt><dd>{decoded.itemCount}</dd></div> : null}</dl></div></div></div>
}

type RecordDetailProps = {
  actionsEnabled: boolean
  record: FulfillmentShipment
  reason: string
  setReason: (value: string) => void
  evidenceChoice: Record<string, string>
  setEvidenceChoice: (value: Record<string, string>) => void
  transitionBusy: boolean
  onTransition: (target: string, evidenceId?: string) => void
  finalTask: FulfillmentTask | null
}

function RecordDetail({ actionsEnabled, record, reason, setReason, evidenceChoice, setEvidenceChoice, transitionBusy, onTransition, finalTask }: RecordDetailProps) {
  const hubEvidence = validEvidence(finalTask, 'hub_pickup')
  const proofEvidence = validEvidence(finalTask, 'delivery_proof')
  const selectedHubEvidence = evidenceChoice.picked_up_from_hub ?? hubEvidence[0]?.id ?? ''
  const selectedProofEvidence = evidenceChoice.delivered ?? proofEvidence[0]?.id ?? ''
  const selectedIntent = completionFor(finalTask, selectedProofEvidence)

  function chooseEvidence(target: string, value: string) {
    setEvidenceChoice({ ...evidenceChoice, [target]: value })
  }

  function transitionControl(target: string) {
    const requiresHubEvidence = target === 'picked_up_from_hub'
    const requiresProof = target === 'delivered'
    const selectedEvidence = requiresHubEvidence ? selectedHubEvidence : requiresProof ? selectedProofEvidence : ''
    const intentMissing = requiresProof && (!selectedIntent || !['awaiting_validation', 'validated'].includes(selectedIntent.status))
    return <div className="border-t border-zinc-200 pt-3 dark:border-white/10" key={target}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium">{transitionLabels[target] ?? human(target)}</p><p className="mt-1 text-xs text-zinc-500">Current shipment state: {human(record.status)}.</p></div><PrimaryButton busy={transitionBusy} disabled={!actionsEnabled || ((requiresHubEvidence || requiresProof) && !selectedEvidence) || intentMissing} onClick={() => onTransition(target, selectedEvidence || undefined)}>{transitionLabels[target] ?? human(target)}</PrimaryButton></div>{requiresHubEvidence ? <EvidenceSelector disabled={!actionsEnabled} label="Hub-pickup evidence" evidence={hubEvidence} value={selectedHubEvidence} onChange={(value) => chooseEvidence('picked_up_from_hub', value)} empty="Waiting for Courier hub-pickup submission." /> : null}{requiresProof ? <><EvidenceSelector disabled={!actionsEnabled} label="Delivery proof" evidence={proofEvidence} value={selectedProofEvidence} onChange={(value) => chooseEvidence('delivered', value)} empty="Waiting for Courier proof submission." />{intentMissing ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">A Courier completion intent for this proof is required before Logistics can validate delivery.</p> : selectedIntent ? <p className="mt-2 text-xs text-zinc-500">Completion intent: <StateLabel value={selectedIntent.status} /> · confirmed {formatDate(selectedIntent.confirmed_at)}</p> : null}</> : null}</div>
  }

  const hubTransitions = record.allowed_transitions.filter((target) => target !== 'received_at_hub' && target !== 'sorted_at_hub' && target !== 'dispatched_from_hub')

  return <div className="p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-zinc-500">Shipment {record.shipment_id}</p><h4 className="mt-1 text-lg font-semibold">{record.parcel?.order_reference ?? record.parcel?.reference ?? 'Fulfillment record'}</h4><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Waybill {record.parcel?.waybill_reference ?? 'unavailable'} · {record.parcel?.item_count ?? 0} item{record.parcel?.item_count === 1 ? '' : 's'}</p></div><StateLabel value={record.status} /></div>
    <dl className="mt-5 grid gap-3 border-y border-zinc-200 py-4 text-sm dark:border-white/10 sm:grid-cols-3"><div><dt className="text-zinc-500">Revision</dt><dd className="mt-1 font-mono">{record.revision}</dd></div><div><dt className="text-zinc-500">Last activity</dt><dd className="mt-1">{formatDate(record.last_activity_at)}</dd></div><div><dt className="text-zinc-500">Allowed next states</dt><dd className="mt-1">{record.allowed_transitions.length || 'None'}</dd></div></dl>

    <section className="mt-5"><div className="flex items-center gap-2"><FaRoute className="text-[#4C1268] dark:text-purple-300" aria-hidden="true" /><h5 className="font-semibold">Custody controls</h5></div><p className="mt-1 text-xs leading-5 text-zinc-500">Receiving, sorting, and dispatch use their dedicated workspaces. This page retains evidence validation and delivery recovery.</p>{!actionsEnabled ? <p className="mt-2 border-l-2 border-amber-500 pl-3 text-xs leading-5 text-amber-800 dark:text-amber-300">Controls are disabled while this is a cached or offline projection. Load the current server record before taking action.</p> : null}{record.status === 'received_at_hub' ? <Link className="mt-3 inline-flex text-sm font-semibold text-[#4C1268] hover:underline dark:text-purple-300" to="/sorting">Open Sorting</Link> : null}<label className="mt-3 block text-sm font-medium" htmlFor="transition-reason">Operational reason (optional)<textarea className={`${field} mt-1 h-20 py-2`} disabled={!actionsEnabled} id="transition-reason" maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder="Add context for a manual recovery or handoff review" value={reason} /></label><div className="mt-4 space-y-3">{hubTransitions.length ? hubTransitions.map(transitionControl) : <p className="border-l-2 border-zinc-300 pl-3 text-sm text-zinc-500 dark:border-white/20">No recovery action is available from this state.</p>}</div></section>

    <section className="mt-7 border-t border-zinc-200 pt-5 dark:border-white/10"><div className="flex items-center gap-2"><FaTruckFast className="text-[#4C1268] dark:text-purple-300" aria-hidden="true" /><h5 className="font-semibold">Task assignments</h5></div><div className="mt-3 space-y-4">{record.tasks.map((task) => <TaskSummary key={task.task_id} task={task} />)}</div></section>

    <section className="mt-7 border-t border-zinc-200 pt-5 dark:border-white/10"><h5 className="font-semibold">Evidence and completion review</h5><p className="mt-1 text-xs leading-5 text-zinc-500">Evidence is shown as a separate lifecycle. A pending Courier submission never changes custody on its own.</p>{finalTask ? <div className="mt-3 space-y-3"><EvidenceHistory task={finalTask} /><CompletionHistory task={finalTask} /></div> : <p className="mt-3 text-sm text-zinc-500">No final-mile task exists until hub dispatch is committed.</p>}</section>
  </div>
}

function TaskSummary({ task }: { task: FulfillmentTask }) {
  return <article className="border border-zinc-200 p-3 dark:border-white/10"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{human(task.leg)}</p><p className="mt-1 text-sm font-medium">Task {task.task_id.slice(0, 8)} · revision {task.revision}</p></div><StateLabel value={task.status} /></div><dl className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-3"><div><dt>Courier</dt><dd className="mt-1 text-zinc-800 dark:text-zinc-200">{task.courier?.name ?? task.courier_id ?? 'Not assigned'}</dd></div><div><dt>Accepted</dt><dd className="mt-1">{formatDate(task.accepted_at)}</dd></div><div><dt>Picked up</dt><dd className="mt-1">{formatDate(task.picked_up_at)}</dd></div></dl></article>
}

function EvidenceSelector({ disabled = false, label, evidence, value, onChange, empty }: { disabled?: boolean; label: string; evidence: FulfillmentEvidence[]; value: string; onChange: (value: string) => void; empty: string }) {
  return <label className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}{evidence.length ? <select className={`${field} mt-1`} disabled={disabled} onChange={(event) => onChange(event.target.value)} value={value}>{evidence.map((item) => <option key={item.id} value={item.id}>{human(item.status)} · {formatDate(item.submitted_at)}</option>)}</select> : <span className="mt-1 block border-l-2 border-amber-500 pl-3 text-xs font-normal text-amber-700 dark:text-amber-300">{empty}</span>}</label>
}

function EvidenceHistory({ task }: { task: FulfillmentTask }) {
  const evidence = task.evidence ?? []
  if (!evidence.length) return <p className="text-sm text-zinc-500">No Courier evidence has been submitted.</p>
  return <div className="border border-zinc-200 dark:border-white/10"><div className="border-b border-zinc-200 px-3 py-2 text-sm font-medium dark:border-white/10">Courier submissions</div><ul className="divide-y divide-zinc-200 dark:divide-white/10">{evidence.map((item) => <li className="flex flex-wrap items-start justify-between gap-3 px-3 py-3" key={item.id}><div><p className="text-sm font-medium capitalize">{human(item.purpose)} · {item.type}</p><p className="mt-1 text-xs text-zinc-500">{item.safe_reference ?? 'Opaque reference'} · submitted {formatDate(item.submitted_at)}</p>{item.rejection_reason ? <p className="mt-1 text-xs text-red-700 dark:text-red-300">Reason: {item.rejection_reason}</p> : null}</div><StateLabel value={item.status} /></li>)}</ul>{evidence.some((item) => item.status === 'awaiting_validation' || item.status === 'submitted') ? <p className="border-t border-zinc-200 px-3 py-3 text-xs text-amber-800 dark:border-white/10 dark:text-amber-300">Courier submission is awaiting Logistics validation. Custody remains {human(task.status)}.</p> : null}</div>
}

function CompletionHistory({ task }: { task: FulfillmentTask }) {
  const intents = task.completion_intents ?? []
  if (!intents.length) return <p className="text-sm text-zinc-500">No Courier completion intent has been submitted.</p>
  return <div className="border border-zinc-200 dark:border-white/10"><div className="border-b border-zinc-200 px-3 py-2 text-sm font-medium dark:border-white/10">Completion intents</div><ul className="divide-y divide-zinc-200 dark:divide-white/10">{intents.map((intent) => <li className="flex flex-wrap items-start justify-between gap-3 px-3 py-3" key={intent.id}><div><p className="text-sm font-medium">Proof {intent.evidence_id.slice(0, 8)}</p><p className="mt-1 text-xs text-zinc-500">Confirmed {formatDate(intent.confirmed_at)} · expected revision {intent.expected_revision}</p></div><StateLabel value={intent.status} /></li>)}</ul>{intents.some((intent) => intent.status === 'awaiting_validation') ? <p className="border-t border-zinc-200 px-3 py-3 text-xs text-amber-800 dark:border-white/10 dark:text-amber-300">Completion intent is waiting for Logistics to validate the proof. It does not mark the Order delivered.</p> : null}</div>
}
