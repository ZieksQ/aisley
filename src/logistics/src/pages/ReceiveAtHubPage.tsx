import '../features/hubOperations/workspaces.css'
import { PortalButton, PortalScanner } from '@aisley/ui/portal'
import { Link, useSearchParams } from 'react-router-dom'
import { ReceivingWorkspace } from '../features/linehaulReceiving/ReceivingWorkspace'
import { useWaybillCamera } from '../lib/useWaybillCamera'
import Dexie from 'dexie'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FaBarcode, FaCloudArrowUp, FaKeyboard, FaTrashCan } from 'react-icons/fa6'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { ErrorNotice } from '../components/PickupUi'
import { ApiError, csrf, request } from '../lib/api'
import { receivingDb, type PendingReceipt } from '../lib/receivingDb'

const AUTO_SYNC_COUNT = 10
const AUTO_SYNC_MS = 5 * 60 * 1000

type BatchResponse = {
  data: Array<{ client_id: string; reference: string; status: 'received' | 'failed'; code?: string; message?: string }>
  summary: { received: number; failed: number }
}

function normalizeReference(value: string): string {
  const trimmed = value.trim()
  const qrMatch = trimmed.match(/^AISLEY:WB:\d+:(.+)$/i)
  return (qrMatch?.[1] ?? trimmed).toUpperCase()
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(new Date(value))
}

export function ReceiveAtHubPage() {
  const [params] = useSearchParams()
  const trip = params.get('trip')
  if (trip) return <div className="portal-page hub-workspace"><h2 className="portal-page-heading">Receive at hub</h2><Link className="mt-2 inline-block text-sm underline" to="/inbound-linehaul">Inbound linehaul</Link><ReceivingWorkspace trip={trip} scanning /></div>
  return <OriginReceiving />
}

function OriginReceiving() {
  const [receipts, setReceipts] = useState<PendingReceipt[]>([])
  const [manualReference, setManualReference] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const videoRef = useRef<HTMLVideoElement>(null)
  const lastAutoSyncBatch = useRef('')

  const loadReceipts = useCallback(async () => {
    setReceipts(await receivingDb.receipts.orderBy('scannedAt').reverse().toArray())
  }, [])

  const queueReceipt = useCallback(async (raw: string, source: PendingReceipt['source']) => {
    const reference = normalizeReference(raw)
    if (!reference) {
      setError('Enter or scan a parcel tracking ID.')
      return
    }
    try {
      await receivingDb.receipts.add({ id: crypto.randomUUID(), reference, scannedAt: new Date().toISOString(), source })
      setNotice(`${reference} scanned · Pending verification. Saved on this device until synced.`)
      setError('')
      setManualReference('')
      await loadReceipts()
    } catch (caught) {
      if (caught instanceof Dexie.ConstraintError) setError(`${reference} is already waiting to sync.`)
      else setError('The scan could not be saved on this device.')
    }
  }, [loadReceipts])

  const sync = useCallback(async () => {
    const queued = await receivingDb.receipts.orderBy('scannedAt').toArray()
    if (!queued.length || !navigator.onLine) return
    setBusy(true)
    setError('')
    try {
      await csrf()
      const response = await request<BatchResponse>('/api/v1/logistics/receiving/batches', {
        method: 'POST',
        body: JSON.stringify({ receipts: queued.map((item) => ({ client_id: item.id, reference: item.reference, scanned_at: item.scannedAt })) }),
      })
      const completed = response.data.filter((item) => item.status === 'received').map((item) => item.client_id)
      if (completed.length) await receivingDb.receipts.bulkDelete(completed)
      for (const failed of response.data.filter((item) => item.status === 'failed')) {
        await receivingDb.receipts.update(failed.client_id, { error: failed.message ?? 'The hub receipt was rejected.' })
      }
      await loadReceipts()
      setNotice(`${response.summary.received} parcel${response.summary.received === 1 ? '' : 's'} synced.${response.summary.failed ? ` ${response.summary.failed} need review.` : ''}`)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The queued receipts remain saved offline. Try syncing again when connected.')
    } finally {
      setBusy(false)
    }
  }, [loadReceipts])

  useEffect(() => { document.title = 'Receive at hub | Aisley Logistics'; void loadReceipts() }, [loadReceipts])
  useEffect(() => {
    const onOnline = () => { setOnline(true); void sync() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const timer = window.setInterval(() => void sync(), AUTO_SYNC_MS)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.clearInterval(timer) }
  }, [sync])
  useEffect(() => {
    if (!online || receipts.length < AUTO_SYNC_COUNT || busy) return
    const batch = receipts.map((receipt) => receipt.id).sort().join(':')
    if (batch === lastAutoSyncBatch.current) return
    lastAutoSyncBatch.current = batch
    void sync()
  }, [busy, online, receipts, sync])

  useWaybillCamera(scannerOpen, videoRef, (raw) => { void queueReceipt(raw, 'barcode') }, (message) => {
    setError(message)
    setScannerOpen(false)
  })

  return <div className="portal-page hub-workspace">
    <div className="hub-page-header">
      <div><div><h2 className="portal-page-heading">Receive at hub</h2></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Record arriving parcels before moving them to sorting. Scans stay on this device until synced.</p></div>
      <ConnectionStatus online={online} syncing={busy} offlineLabel="Offline — scans are safe on this device" />
    </div>

    {error ? <div className="mt-4"><ErrorNotice message={error} /></div> : null}
    {notice ? <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}

    <div className="hub-receiving-grid">
      <PortalScanner title="Barcode & QR scanner" feedback={notice} error={error} controls={<PortalButton onClick={() => setScannerOpen((value) => !value)}>{scannerOpen ? 'Stop camera' : 'Start camera'}</PortalButton>}>
        <div className="p-4">
          {scannerOpen ? <><video ref={videoRef} className="aspect-video max-h-64 w-full bg-black object-contain" autoPlay muted playsInline /><p className="portal-secondary mt-2 text-xs">Keep the full barcode or QR code in view. Both formats use the same scanner.</p></> : <div className="portal-scanner-placeholder"><div><FaBarcode className="mx-auto mb-3 text-3xl" aria-hidden="true" /><p>Ready to receive parcels</p><p className="mt-1 text-xs">Start the camera to scan a barcode or 2D QR code.</p></div></div>}
        </div>
      </PortalScanner>

      <section className="portal-section">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700"><h3 className="font-semibold">Manual entry</h3></div>
        <form className="p-4" onSubmit={(event) => { event.preventDefault(); void queueReceipt(manualReference, 'manual') }}>
          <label className="block text-sm font-medium" htmlFor="parcel-reference">Tracking ID or waybill reference</label>
          <div className="relative mt-1"><FaKeyboard className="pointer-events-none absolute left-3 top-3 text-slate-400" aria-hidden="true" /><input id="parcel-reference" className={`portal-input pl-9!`} value={manualReference} onChange={(event) => setManualReference(event.target.value)} autoComplete="off" placeholder="AWB-..." /></div>
          <PortalButton variant="primary" className="mt-3 w-full" type="submit">Add to receiving queue</PortalButton>
        </form>
      </section>
    </div>

    <section className={`portal-section mt-5 overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700"><div><h3 className="font-semibold">Pending on this device ({receipts.length})</h3><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Auto-syncs at 10 parcels, when connection returns, or every 5 minutes.</p></div><PortalButton variant="primary" isLoading={busy} disabled={!online || receipts.length === 0} onClick={() => void sync()}><FaCloudArrowUp aria-hidden="true" />Sync scans</PortalButton></div>
      {receipts.length ? <ul className="divide-y divide-slate-200 dark:divide-white/10">{receipts.map((receipt) => <li key={receipt.id} className="flex items-start justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="break-all font-mono text-sm font-medium">{receipt.reference}</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{receipt.source === 'barcode' ? 'Scanned' : 'Entered manually'} · {formatDate(receipt.scannedAt)}</p>{receipt.error ? <p className="mt-1 text-xs text-red-700 dark:text-red-300">{receipt.error}</p> : null}</div><button type="button" aria-label={`Remove ${receipt.reference}`} className="grid size-11 place-items-center rounded-md text-slate-600 dark:text-slate-400 hover:bg-slate-100 hover:text-red-700 dark:hover:bg-white/10" onClick={() => void receivingDb.receipts.delete(receipt.id).then(loadReceipts)}><FaTrashCan aria-hidden="true" /></button></li>)}</ul> : <div className="portal-state border-0! rounded-none!"><p className="portal-state-title">Receiving queue is clear</p><p className="portal-secondary">Scan a parcel or enter its tracking ID to start receiving.</p></div>}
    </section>
  </div>
}
