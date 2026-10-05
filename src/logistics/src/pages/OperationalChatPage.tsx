import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChatWorkspace, clearChatPrivateState, type ChatEntry } from '@aisley/chat-ui'
import { OperationalThreadPanel } from '../components/OperationalThreadPanel'
import { ApiError } from '../lib/api'
import { operationalChat, type OperationalThread } from '../lib/operationalChat'

export function OperationalChatPage() {
  const [params, setParams] = useSearchParams()
  const [threads, setThreads] = useState<OperationalThread[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [error, setError] = useState('')
  const leg = params.get('leg')
  const taskId = params.get('task_id')
  const orderId = params.get('order_id')
  const pickupRequestId = params.get('pickup_request_id')
  const context: { leg: 'first_mile' | 'final_mile'; taskId: string } | { orderId: string } | { pickupRequestId: string } | null =
    pickupRequestId ? { pickupRequestId } : orderId ? { orderId } : leg === 'first_mile' || leg === 'final_mile' ? taskId ? { leg, taskId } : null : null
  const selected = threads.find((thread) => thread.id === selectedId) ?? null

  useEffect(() => {
    if (context) setSelectedId(null)
  }, [leg, taskId, orderId, pickupRequestId])

  const load = useCallback(async (append = false, cursor?: string) => {
    if (!navigator.onLine) {
      setError('You are offline. Reconnect to load messages.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const page = await operationalChat.list(cursor)
      setThreads((current) => append
        ? [...current, ...page.data.filter((item) => !current.some((saved) => saved.id === item.id))]
        : [...page.data, ...current.filter((item) => !page.data.some((fresh) => fresh.id === item.id))])
      setNextCursor(page.meta.next_cursor)
      setUnreadTotal(page.meta.unread_count ?? 0)
      setError('')
    } catch (caught) {
      if (caught instanceof ApiError && [401, 403].includes(caught.status)) { clearChatPrivateState(); setThreads([]); setSelectedId(null); }
      setError(caught instanceof ApiError ? caught.message : 'The operational inbox could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'Operational messages | Aisley Logistics'
    void load()
  }, [load])
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void load()
    }
    const timer = window.setInterval(poll, 15000)
    window.addEventListener('focus', poll)
    window.addEventListener('online', poll)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', poll)
      window.removeEventListener('online', poll)
    }
  }, [load])

  function saved(thread: OperationalThread) {
    setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)])
    setSelectedId(thread.id)
    setParams({})
  }

  function backToInbox() {
    setSelectedId(null)
    setParams({})
  }

  const entries: ChatEntry[] = threads.map((thread) => ({
    id: thread.id,
    title: thread.counterparty_label,
    preview: thread.last_message_preview ?? '',
    activity: thread.last_message_at,
    unread: thread.unread_count,
    context: thread.kind === 'seller_logistics'
      ? `Pickup ${thread.pickup_request_reference ?? thread.pickup_request_id.slice(0, 8)} · Seller`
      : thread.kind === 'customer_logistics'
        ? `Order ${thread.order_reference ?? thread.order_id.slice(0, 8)} · Customer`
        : `${thread.task_reference ?? thread.task_id.slice(0, 8)} · ${thread.leg.replaceAll('_', ' ')}`,
    selected: selectedId === thread.id,
    readOnly: Boolean(thread.read_only_reason),
    onSelect: () => { setSelectedId(thread.id); setParams({}) },
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Operational messages</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Private conversations tied to pickup requests, delivery tasks, and handled Orders.
            {unreadTotal ? ` ${unreadTotal} unread message${unreadTotal === 1 ? '' : 's'}.` : ''}
          </p>
        </div>
        <button className="border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-white/20 dark:hover:bg-white/5" onClick={() => void load()} type="button">
          Refresh inbox
        </button>
      </div>
      <ChatWorkspace
        entries={entries}
        selected={Boolean(selected || context)}
        inboxTitle={`Inbox · ${unreadTotal} unread`}
        inboxStatus={loading && !threads.length ? <p className="p-4 text-sm text-zinc-500" role="status">Loading conversations…</p> : null}
        inboxError={error || undefined}
        onRetryInbox={() => void load()}
        canLoadMore={Boolean(nextCursor)}
        loadingMore={loading}
        onLoadMore={() => { if (nextCursor) void load(true, nextCursor) }}
        onBack={backToInbox}
      >
        {selected || context ? <OperationalThreadPanel context={context} onSaved={saved} selected={selected} /> : (
          <div className="grid min-h-full place-items-center p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Select a conversation, or open a pickup request, assigned task, or handled Order to start one.</div>
        )}
      </ChatWorkspace>
    </div>
  )
}
