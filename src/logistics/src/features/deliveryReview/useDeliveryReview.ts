import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import { loadPhoto, loadReviews, submitReview, type Confirmation, type ReviewAttempt } from './api'

export function useDeliveryReview(view: 'pending' | 'history', query: string, page: number) {
  const [rows, setRows] = useState<Confirmation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoVersion, setPhotoVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState<ReviewAttempt | null>(null)
  const generation = useRef(0)
  const pending = useRef<ReviewAttempt | null>(null)
  const selected = rows.find((row) => row.proof.id === selectedId) ?? null
  const clearPrivate = useCallback(() => {
    setRows([]);
    setSelectedId(null);
    setPhotoUrl(null);
    setAttempt(null);
    pending.current = null
  }, [])

  const load = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    setError('')
    try {
      const response = await loadReviews(view, query, page)
      if (current !== generation.current) return
      setRows(response.data)
      setLastPage(response.meta.last_page)
      setTotal(response.meta.total)
      setSelectedId((id) => response.data.some((row) => row.proof.id === id) ? id : response.data[0]?.proof.id ?? null)
      if (pending.current) {
        const decision = await loadReviews('history', pending.current.reference, 1)
        if (current !== generation.current) return
        const proof = decision.data.find((row) => row.proof.id === pending.current?.proofId)
        if (proof && (proof.proof.status === 'validated' || proof.proof.status === 'rejected')) {
          setNotice(proof.proof.status === 'validated' ? 'Delivery has been approved.' : 'Correction has been requested.')
          setAttempt(null)
          pending.current = null
        }
      }
    } catch (caught) {
      if (current !== generation.current) return
      if (caught instanceof ApiError && [401, 403].includes(caught.status)) clearPrivate()
      setError(caught instanceof Error ? caught.message : 'Could not load delivery reviews.')
    } finally {
      if (current === generation.current) setLoading(false)
    }
  }, [view, query, page, clearPrivate])

  useEffect(() => {
    void load();
    return () => {
      generation.current++
    }
  }, [load])
  useEffect(() => {
    let active = true
    let url: string | null = null
    setPhotoUrl(null)
    setPhotoError('')
    setPhotoLoading(Boolean(selectedId))
    if (selectedId) void loadPhoto(selectedId).then((photo) => {
      if (!active) return
      url = URL.createObjectURL(photo)
      setPhotoUrl(url)
    }).catch((caught: unknown) => {
      if (!active) return
      if (caught instanceof ApiError && [401, 403].includes(caught.status)) clearPrivate()
      setPhotoError(caught instanceof Error ? caught.message : 'Photo unavailable. Try again.')
    }).finally(() => {
      if (active) setPhotoLoading(false)
    })
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url)
    }
  }, [selectedId, photoVersion, clearPrivate])

  async function run(next: ReviewAttempt) {
    if (busy) return
    pending.current = next
    setAttempt(next)
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await submitReview(next)
      pending.current = null
      setAttempt(null)
      setNotice(next.kind === 'approve' ? `Delivery ${next.reference} approved.` : `Correction requested for ${next.reference}.`)
      await load()
    } catch (caught) {
      if (caught instanceof ApiError && [401, 403].includes(caught.status)) clearPrivate()
      if (caught instanceof ApiError && caught.status >= 400 && caught.status < 500) {
        pending.current = null
        setAttempt(null)
        if (caught.status === 409) await load()
      }
      setError(caught instanceof Error ? caught.message : 'The result is uncertain. Refresh or retry the same action.')
    } finally {
      setBusy(false)
    }
  }

  return {
    rows,
    selected,
    select: (id: string) => {
      setPhotoUrl(null);
      setSelectedId(id)
    },
    loading,
    error,
    notice,
    total,
    lastPage,
    photoUrl,
    photoError,
    photoLoading,
    reloadPhoto: () => setPhotoVersion((value) => value + 1),
    load,
    busy,
    attempt,
    run,
    locked: busy || attempt !== null
  }
}
