import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { cacheParcels, readCachedQueue } from '../../lib/parcelSearchDb'
import type { FulfillmentQueueResponse } from '../../types/fulfillment'
import { fetchParcelQueue } from './api'
import { canUseOffline } from './readFallback'

const PAGE_SIZE = 10

export function useParcelQueue(context: string) {
  const [params, setParams] = useSearchParams()
  const appliedSearch = params.get('search') ?? ''
  const appliedStatus = params.get('status') ?? ''
  const appliedEvidenceStatus = params.get('evidence_status') ?? ''
  const parsedPage = Number(params.get('page') ?? 1)
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const [search, setSearch] = useState(appliedSearch)
  const [status, setStatus] = useState(appliedStatus)
  const [evidenceStatus, setEvidenceStatus] = useState(appliedEvidenceStatus)
  const [queue, setQueue] = useState<FulfillmentQueueResponse | null>(null)
  const [queueLoading, setQueueLoading] = useState(true)
  const [queueError, setQueueError] = useState('')
  const [queueNotice, setQueueNotice] = useState('')
  const queueGeneration = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      queueGeneration.current++
    }
  }, [])
  useEffect(() => {
    setSearch(appliedSearch)
    setStatus(appliedStatus)
    setEvidenceStatus(appliedEvidenceStatus)
  }, [appliedSearch, appliedStatus, appliedEvidenceStatus])
  const loadQueue = useCallback(async () => {
    const generation = ++queueGeneration.current
    const current = () =>
      mounted.current && generation === queueGeneration.current
    setQueueLoading(true)
    setQueueError('')
    setQueueNotice('')
    setQueue(null)
    const query = new URLSearchParams({
      per_page: String(PAGE_SIZE),
      page: String(page),
    })
    if (appliedSearch.trim()) query.set('search', appliedSearch.trim())
    if (appliedStatus) query.set('status', appliedStatus)
    if (appliedEvidenceStatus)
      query.set('evidence_status', appliedEvidenceStatus)
    try {
      if (!navigator.onLine) throw new ApiError(0, { message: 'Offline' })
      const result = await fetchParcelQueue(query)
      if (!current()) return
      setQueue(result)
      void cacheParcels(context, result.data).catch(() => undefined)
    } catch (error) {
      if (!current()) return
      const cached = canUseOffline(error)
        ? await readCachedQueue(
            context,
            appliedSearch,
            appliedStatus,
            appliedEvidenceStatus,
            page,
            PAGE_SIZE,
          ).catch(() => null)
        : null
      if (!current()) return
      if (cached) {
        setQueue(cached)
        setQueueNotice(
          'Cached parcel results. Current server status may have changed.',
        )
      } else
        setQueueError(
          error instanceof ApiError && error.status !== 0
            ? error.message
            : 'No parcel results are available offline. Connect and try again.',
        )
    } finally {
      if (current()) setQueueLoading(false)
    }
  }, [appliedSearch, appliedStatus, appliedEvidenceStatus, context, page])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])
  function applyFilters(event: FormEvent) {
    event.preventDefault()
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('page')
      for (const [key, value] of [
        ['search', search.trim()],
        ['status', status],
        ['evidence_status', evidenceStatus],
      ]) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      return next
    })
  }
  function resetFilters() {
    setSearch('')
    setStatus('')
    setEvidenceStatus('')
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      for (const key of ['search', 'status', 'evidence_status', 'page'])
        next.delete(key)
      return next
    })
  }
  function setPage(value: number) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('page', String(value))
      return next
    })
  }
  return {
    search,
    setSearch,
    status,
    setStatus,
    evidenceStatus,
    setEvidenceStatus,
    queue,
    queueLoading,
    queueError,
    queueNotice,
    setQueueNotice,
    page,
    setPage,
    loadQueue,
    applyFilters,
    resetFilters,
  }
}
