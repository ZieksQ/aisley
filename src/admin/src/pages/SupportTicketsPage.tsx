import { useCallback, useEffect, useState } from 'react'
import type { SupportTicket, TicketDetail } from '@aisley/support-tickets'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { SupportTicketDetail } from '../components/support/SupportTicketDetail'
import { SupportTicketQueue } from '../components/support/SupportTicketQueue'
import {
  getSupportTicket,
  listSupportAssignees,
  listSupportTickets,
  markSupportTicketRead,
  type SupportAssignee,
  type SupportTicketFilters,
} from '../lib/supportTickets'

export function SupportTicketsPage() {
  const { admin } = useAuth()
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const [filters, setFilters] = useState<SupportTicketFilters>({ assignee: 'all' })
  const [items, setItems] = useState<SupportTicket[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [assignees, setAssignees] = useState<SupportAssignee[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canManage = admin?.permissions.includes('support-tickets.manage') ?? false

  const refreshList = useCallback(async () => {
    try {
      const response = await listSupportTickets(filters)
      setItems(response.items)
      setCursor(response.next_cursor)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The queue could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const refreshDetail = useCallback(async (id: string) => {
    try {
      const response = await getSupportTicket(id)
      setDetail(response)
      const latest = response.events.at(-1)?.sequence
      if (latest !== undefined) {
        void markSupportTicketRead(id, latest).then(() => {
          setItems((current) => current.map((item) => item.id === id ? { ...item, unread_count: 0 } : item))
        }).catch(() => undefined)
      }
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The ticket could not be loaded.')
    }
  }, [])

  useEffect(() => { void refreshList() }, [refreshList])
  useEffect(() => { if (ticketId) { setDetail(null); void refreshDetail(ticketId) } else setDetail(null) }, [ticketId, refreshDetail])
  useEffect(() => {
    if (!canManage) return
    void listSupportAssignees().then((response) => setAssignees(response.items)).catch(() => undefined)
  }, [canManage])
  useEffect(() => {
    const refresh = () => { if (!document.hidden) { void refreshList(); if (ticketId) void refreshDetail(ticketId) } }
    const timer = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh) }
  }, [refreshList, refreshDetail, ticketId])

  async function loadMore() {
    if (!cursor) return
    try {
      const response = await listSupportTickets({ ...filters, cursor })
      setItems((current) => [...current, ...response.items.filter((item) => !current.some((existing) => existing.id === item.id))])
      setCursor(response.next_cursor)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'More tickets could not be loaded.')
    }
  }

  async function loadOlder() {
    if (!ticketId || !detail?.next_cursor || loadingOlder) return
    setLoadingOlder(true)
    try {
      const older = await getSupportTicket(ticketId, detail.next_cursor)
      setDetail((current) => current?.data.id === ticketId ? {
        ...current,
        events: [...older.events, ...current.events.filter((event) => !older.events.some((prior) => prior.id === event.id))],
        next_cursor: older.next_cursor,
      } : current)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Older history could not be loaded.')
    } finally {
      setLoadingOlder(false)
    }
  }

  function changed() { void refreshList(); if (ticketId) void refreshDetail(ticketId) }

  if (!admin?.permissions.includes('support-tickets.view')) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">You do not have permission to view support tickets.</p>
  }

  return <div className="mx-auto max-w-[1400px]">
    <div className="mb-5">
      <h1 className="text-2xl font-semibold">Support tickets</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Review issues submitted by active platform users.</p>
    </div>
    {error && <p className="mb-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/30 dark:text-red-200" role="alert">
      {error} <button className="underline" onClick={changed} type="button">Retry</button>
    </p>}
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
      <SupportTicketQueue
        filters={filters}
        hasMore={Boolean(cursor)}
        loading={loading}
        onFilters={(next) => { setLoading(true); setFilters(next) }}
        onMore={() => void loadMore()}
        onSelect={(id) => navigate(`/support-tickets/${id}`)}
        selectedId={ticketId ?? null}
        tickets={items}
      />
      <div>
        {ticketId && !detail && <p className="text-sm text-slate-500">Loading ticket…</p>}
        {detail && detail.data.id === ticketId && <SupportTicketDetail
          assignees={assignees}
          canManage={canManage}
          detail={detail}
          loadingOlder={loadingOlder}
          onChanged={changed}
          onLoadOlder={() => void loadOlder()}
        />}
      </div>
    </div>
  </div>
}
