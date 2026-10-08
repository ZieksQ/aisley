import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupportTicket, TicketClient, TicketDetail } from '@aisley/support-tickets'

const message = (caught: unknown, fallback: string) => caught instanceof Error ? caught.message : fallback

export function useSupportTickets(client: TicketClient) {
  const [items, setItems] = useState<SupportTicket[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [moreBusy, setMoreBusy] = useState(false)
  const [olderBusy, setOlderBusy] = useState(false)
  const active = useRef(false)
  const selection = useRef(selectedId)
  const listRequest = useRef(0)
  const detailRequest = useRef(0)
  const paged = useRef(false)
  const loadingMore = useRef(false)
  const loadingOlder = useRef(false)
  const hasOlder = useRef(false)

  const refreshList = useCallback(async () => {
    if (loadingMore.current) return
    const request = ++listRequest.current
    try {
      const result = await client.list()
      if (!active.current || request !== listRequest.current) return
      setItems((current) => paged.current ? [...result.items, ...current.filter((item) => !result.items.some((fresh) => fresh.id === item.id))] : result.items)
      if (!paged.current) setCursor(result.next_cursor)
      setError('')
    } catch (caught) {
      if (active.current && request === listRequest.current) setError(message(caught, 'Tickets could not be loaded.'))
    } finally {
      if (active.current && request === listRequest.current) setLoading(false)
    }
  }, [client])

  const refreshDetail = useCallback(async (id: string) => {
    if (loadingOlder.current) return
    const request = ++detailRequest.current
    try {
      const result = await client.detail(id)
      if (!active.current || selection.current !== id || request !== detailRequest.current) return
      setDetail((current) => hasOlder.current && current?.data.id === id ? {
        ...result,
        events: [...current.events.filter((event) => !result.events.some((fresh) => fresh.id === event.id)), ...result.events].sort((a, b) => a.sequence - b.sequence),
        next_cursor: current.next_cursor,
      } : result)
      setDetailError('')
      const latest = result.events.at(-1)?.sequence
      if (latest !== undefined) void client.read(id, latest).then(() => {
        if (active.current && selection.current === id) setItems((current) => current.map((item) => item.id === id ? { ...item, unread_count: 0 } : item))
      }).catch(() => undefined)
    } catch (caught) {
      if (active.current && selection.current === id && request === detailRequest.current) setDetailError(message(caught, 'Ticket history could not be loaded.'))
    } finally {
      if (active.current && selection.current === id && request === detailRequest.current) setDetailLoading(false)
    }
  }, [client])

  useEffect(() => {
    active.current = true
    void refreshList()
    return () => { active.current = false; ++listRequest.current; ++detailRequest.current }
  }, [refreshList])

  useEffect(() => {
    selection.current = selectedId
    ++detailRequest.current
    hasOlder.current = false
    setDetail(null)
    setDetailError('')
    setDetailLoading(Boolean(selectedId))
    if (selectedId) void refreshDetail(selectedId)
  }, [selectedId, refreshDetail])

  const refresh = useCallback(() => {
    void refreshList()
    if (selection.current) void refreshDetail(selection.current)
  }, [refreshList, refreshDetail])

  useEffect(() => {
    const visibleRefresh = () => { if (!document.hidden) refresh() }
    const timer = window.setInterval(visibleRefresh, 30000)
    window.addEventListener('focus', visibleRefresh)
    window.addEventListener('online', visibleRefresh)
    document.addEventListener('visibilitychange', visibleRefresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', visibleRefresh)
      window.removeEventListener('online', visibleRefresh)
      document.removeEventListener('visibilitychange', visibleRefresh)
    }
  }, [refresh])

  async function loadMore() {
    if (!cursor || loadingMore.current) return
    loadingMore.current = true
    ++listRequest.current
    setMoreBusy(true)
    try {
      const result = await client.list(cursor)
      if (!active.current) return
      paged.current = true
      setItems((current) => [...current, ...result.items.filter((item) => !current.some((existing) => existing.id === item.id))])
      setCursor(result.next_cursor)
      setError('')
    } catch (caught) {
      if (active.current) setError(message(caught, 'More tickets could not be loaded.'))
    } finally {
      loadingMore.current = false
      if (active.current) { setMoreBusy(false); setLoading(false) }
    }
  }

  async function loadOlder() {
    const id = selectedId
    if (!id || !detail?.next_cursor || loadingOlder.current) return
    loadingOlder.current = true
    ++detailRequest.current
    setOlderBusy(true)
    try {
      const older = await client.detail(id, detail.next_cursor)
      if (!active.current || selection.current !== id) return
      hasOlder.current = true
      setDetail((current) => current?.data.id === id ? { ...current, events: [...older.events, ...current.events.filter((event) => !older.events.some((previous) => previous.id === event.id))], next_cursor: older.next_cursor } : current)
      setDetailError('')
    } catch (caught) {
      if (active.current && selection.current === id) setDetailError(message(caught, 'Older history could not be loaded.'))
    } finally {
      loadingOlder.current = false
      if (active.current) setOlderBusy(false)
    }
  }

  return { items, cursor, selectedId, setSelectedId, detail, loading, detailLoading, error, detailError, moreBusy, olderBusy, loadMore, loadOlder, refresh }
}
