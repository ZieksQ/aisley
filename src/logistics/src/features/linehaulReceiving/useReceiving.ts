import { useCallback, useEffect, useRef, useState } from 'react'
import { getReceiving, receivingAction, syncReceiving } from './api'
import { linehaulReceivingDb as db } from './db'
import type { Capture, PendingCapture, ReceivingDetail } from './types'

export function useReceiving(trip: string, scope: string) {
  const [detail, setDetail] = useState<ReceivingDetail | null>(null)
  const [pending, setPending] = useState<PendingCapture[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const locked = useRef(false)
  const active = useRef(true)

  const save = useCallback(async (value: ReceivingDetail) => {
    if (!active.current) return
    await db.manifests.put({ scope, detail: value })
    if (active.current) setDetail(value)
  }, [scope])

  const reloadQueue = useCallback(async () => {
    const values = await db.captures.where('scope').equals(scope).sortBy('captured_at')
    if (active.current) setPending(values)
  }, [scope])

  const refresh = useCallback(async () => {
    try {
      if (navigator.onLine) await save(await getReceiving(trip))
      await reloadQueue()
    } catch (caught) {
      if (active.current) setError(caught instanceof Error ? caught.message : 'Unable to refresh receiving.')
    }
  }, [trip, save, reloadQueue])

  const sync = useCallback(async () => {
    if (locked.current || !navigator.onLine || !active.current) return
    locked.current = true
    setBusy(true)
    try {
      const queued = await db.captures.where('scope').equals(scope).sortBy('captured_at')
      for (let offset = 0; offset < queued.length; offset += 100) {
        if (!active.current) return
        const captures = queued.slice(offset, offset + 100).map((item) => ({
          client_id: item.client_id,
          reference: item.reference,
          condition: item.condition,
          source: item.source,
          captured_at: item.captured_at,
          reason: item.reason,
        }))
        const result = await syncReceiving(trip, captures)
        if (!active.current) return
        for (const item of result.results) {
          if (item.status === 'failed') {
            await db.captures.update(item.client_id, { error: item.message ?? 'Scan rejected.' })
          } else {
            await db.captures.delete(item.client_id)
          }
        }
        await save(result.receiving)
      }
      await reloadQueue()
      if (active.current && queued.length) {
        setError('')
        setNotice('Synchronization completed. Review server counts and any remaining local errors.')
      }
    } catch (caught) {
      if (active.current) {
        setError(caught instanceof Error ? caught.message : 'Scans remain saved on this device. Retry when connected.')
      }
    } finally {
      locked.current = false
      if (active.current) setBusy(false)
    }
  }, [trip, scope, save, reloadQueue])

  const capture = useCallback(async (raw: string, source: Capture['source'], condition: Capture['condition'], reason: string) => {
    const reference = raw.trim().replace(/^AISLEY:WB:\d+:/i, '').toUpperCase()
    if (!reference || reference.length > 255 || (condition === 'damaged' && !reason.trim())) {
      setError('Enter a tracking ID and a reason for any damage.')
      return
    }
    if (!detail?.arrived_at || detail.historical_receipt) {
      setError('Start receiving online before capturing parcels.')
      return
    }
    if (detail.items.some((item) => item.reference.toUpperCase() === reference && item.receipt)) {
      setNotice(`${reference} has already been received by the server.`)
      return
    }
    try {
      await db.captures.add({
        scope,
        client_id: crypto.randomUUID(),
        reference,
        source,
        condition,
        reason: reason.trim() || null,
        captured_at: new Date().toISOString(),
      })
      setError('')
      setNotice(`${reference} captured locally; awaiting server verification.`)
      await reloadQueue()
      void sync()
    } catch {
      setError('This tracking ID is already queued, or device storage is unavailable.')
    }
  }, [scope, detail, reloadQueue, sync])

  const action = useCallback(async (name: string, body: object = {}) => {
    if (locked.current || !navigator.onLine) {
      setError('Connect and wait for synchronization before continuing.')
      return false
    }
    locked.current = true
    setBusy(true)
    setError('')
    try {
      if (name === 'finish' && await db.captures.where('scope').equals(scope).count()) {
        throw new Error('Synchronize all scans on this device before finishing unloading.')
      }
      await save(await receivingAction(trip, name, { client_id: crypto.randomUUID(), ...body }))
      return true
    } catch (caught) {
      if (active.current) setError(caught instanceof Error ? caught.message : 'Receiving action failed.')
      return false
    } finally {
      locked.current = false
      if (active.current) setBusy(false)
    }
  }, [trip, scope, save])

  useEffect(() => {
    active.current = true
    void db.manifests.get(scope)
      .then((cached) => { if (active.current && cached) setDetail(cached.detail) })
      .then(refresh)
      .then(sync)
      .catch(() => { if (active.current) setError('Device storage is unavailable. Enable storage before capturing scans.') })
    const onOnline = () => { setOnline(true); void sync().then(refresh) }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const timer = window.setInterval(() => { void sync().then(refresh) }, 15000)
    return () => {
      active.current = false
      window.clearInterval(timer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [scope, refresh, sync])

  return { detail, pending, busy, online, error, notice, capture, sync, action, refresh }
}
