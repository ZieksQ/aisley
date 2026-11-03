import { LogisticsMessageThread } from '../components/LogisticsMessageThread'
import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChatLoadingThread, ChatWorkspace, clearChatPrivateState, type ChatEntry } from '@aisley/ui/chat'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import { logisticsMessages, logisticsMessageError as failure, type LogisticsThread } from '../lib/logisticsMessages'

export function LogisticsMessagesPage({ embedded = false }: { embedded?: boolean }) {
  const { seller } = useAuth()
  const accountId = seller?.id ?? 'unknown'
  const [params, setParams] = useSearchParams()
  const pickupId = params.get('pickup_request_id')
  const conversationId = params.get('conversation')
  const [threads, setThreads] = useState<LogisticsThread[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(conversationId)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [unread, setUnread] = useState(0)
  const selected = threads.find((item) => item.id === selectedId) ?? null

  const load = useCallback(async (append = false, next?: string) => {
    if (embedded && conversationId) return
    if (!navigator.onLine) {
      setError('You are offline. Reconnect to load messages.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const page = await logisticsMessages.list(next)
      setThreads((current) => append
        ? [...current, ...page.data.filter((item) => !current.some((saved) => saved.id === item.id))]
        : [...page.data, ...current.filter((item) => !page.data.some((fresh) => fresh.id === item.id))])
      setCursor(page.meta.next_cursor)
      setUnread(page.meta.unread_count ?? 0)
      setError('')
    } catch (reason) {
      if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
        clearChatPrivateState(); setThreads([]); setSelectedId(null);
      }
      setError(failure(reason))
    } finally {
      setLoading(false)
    }
  }, [embedded, conversationId])

  useEffect(() => {
    document.title = 'Logistics messages | Aisley Seller'
    void load()
  }, [load])
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void load()
    }
    const timer = window.setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [load])
  useEffect(() => {
    if (pickupId) setSelectedId(threads.find((item) => item.pickup_request_id === pickupId)?.id ?? null)
  }, [pickupId, threads])

  useEffect(() => {
    if (pickupId) return
    let active = true
    setSelectedId(conversationId)
    if (conversationId) {
      void logisticsMessages.show(conversationId).then(({ data }) => {
        if (active) setThreads((current) => [data, ...current.filter((item) => item.id !== data.id)])
      }).catch((reason) => {
        if (!active) return
        setSelectedId(null)
        if (reason instanceof ApiError && [401, 403].includes(reason.status)) { clearChatPrivateState(); setThreads([]) }
        setError(failure(reason))
      })
    }
    return () => { active = false }
  }, [conversationId, pickupId])

  function saved(thread: LogisticsThread) {
    setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)])
    setSelectedId(thread.id)
    setParams((current) => { const next = new URLSearchParams(current); next.delete('pickup_request_id'); next.set('kind', 'seller_logistics'); next.set('conversation', thread.id); return next })
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
    context: `Pickup ${thread.pickup_request_reference ?? thread.pickup_request_id.slice(0, 8)}`,
    selected: selectedId === thread.id,
    readOnly: Boolean(thread.read_only_reason),
    onSelect: () => { setSelectedId(thread.id); setParams((current) => { const next = new URLSearchParams(current); next.delete('pickup_request_id'); next.set('kind', 'seller_logistics'); next.set('conversation', thread.id); return next }) },
  }))

  return (
    <div className={embedded ? undefined : "mx-auto max-w-7xl px-2 py-3 sm:px-4 lg:px-6"}>
      <div className={embedded ? "hidden" : `${selectedId || pickupId ? "hidden min-[800px]:flex" : "flex"} mb-3 flex-wrap items-end justify-between gap-3`}>
        <div>
          <h2 className="text-xl font-semibold">Logistics messages</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Private conversations for your pickup requests.{unread ? ` ${unread} unread.` : ''}
          </p>
        </div>
        <button className="border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-white/20 dark:hover:bg-white/5" onClick={() => void load()} type="button">
          Refresh inbox
        </button>
      </div>
      <ChatWorkspace
        entries={entries}
        selected={Boolean(conversationId || pickupId)}
        inboxTitle={`Pickup conversations · ${unread} unread`}
        inboxStatus={loading && !threads.length ? <p className="p-4 text-sm text-zinc-500" role="status">Loading conversations…</p> : null}
        inboxError={error || undefined}
        onRetryInbox={() => void load()}
        canLoadMore={Boolean(cursor)}
        loadingMore={loading}
        onLoadMore={() => { if (cursor) void load(true, cursor) }}
        onBack={backToInbox}
      >
        {selected || pickupId ? <LogisticsMessageThread accountId={accountId} contextId={selected ? null : pickupId} onSaved={saved} selected={selected} /> : conversationId ? error ? <p className="m-4 text-sm" role="alert">{error}</p> : <ChatLoadingThread /> : (
          <div className="grid min-h-full place-items-center p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">Select a pickup conversation or open one of your pickup requests to contact Logistics.</div>
        )}
      </ChatWorkspace>
    </div>
  )
}
