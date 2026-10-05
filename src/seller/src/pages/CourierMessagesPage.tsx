import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChatWorkspace, type ChatEntry } from '@aisley/chat-ui'
import { useAuth } from '../auth/useAuth'
import { CourierThread } from '../components/courier-messages/CourierThread'
import { courierError, useCourierAccess } from '../components/courier-messages/useCourierAccess'
import { useCourierRefresh } from '../components/courier-messages/useCourierRefresh'
import { courierMessages, type CourierConversation } from '../lib/courierMessages'

export function CourierMessagesPage() {
  const { seller } = useAuth()
  return <CourierInbox key={seller?.id} />
}

function CourierInbox() {
  const [params, setParams] = useSearchParams()
  const conversationId = params.get('conversation')
  const orderId = params.get('order')
  const accessError = useCourierAccess()
  const [threads, setThreads] = useState<CourierConversation[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [unread, setUnread] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)
  const [revision, setRevision] = useState(0)
  const initialized = useRef(false)
  const requestSignal = useRef<AbortSignal | null>(null)
  const moreBusy = useRef(false)
  const onUpdated = useCallback(() => setRevision((value) => value + 1), [])
  const onStarted = useCallback((id: string) => setParams({ conversation: id }, { replace: true }), [setParams])

  useEffect(() => { document.title = 'Courier messages | Aisley Seller' }, [])
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync) }
  }, [])
  const refresh = useCallback(async (signal: AbortSignal) => {
    requestSignal.current = signal
    try {
      const response = await courierMessages.inbox(null, signal)
      if (signal.aborted) return
      setThreads((current) => {
        if (!response.data.length) return []
        // Latest page leads; retain older pages without duplicating records.
        return [...response.data, ...current.filter((thread) => !response.data.some((item) => item.id === thread.id))]
      })
      if (!initialized.current || !response.data.length) setCursor(response.meta.next_cursor)
      else setCursor((current) => current ?? response.meta.next_cursor)
      initialized.current = true
      setUnread(response.meta.unread_count ?? 0)
      setError('')
      setDenied(false)
    } catch (reason) {
      if (signal.aborted) return
      if (accessError(reason)) { setThreads([]); setUnread(0); setDenied(true) }
      setError(courierError(reason))
    } finally { if (!signal.aborted) setLoading(false) }
  }, [accessError])
  useCourierRefresh(refresh, revision)

  async function loadMore() {
    if (!cursor || moreBusy.current) return
    moreBusy.current = true
    setMoreLoading(true)
    const signal = requestSignal.current
    try {
      const page = await courierMessages.inbox(cursor, signal ?? undefined)
      if (signal?.aborted) return
      setThreads((current) => [...current, ...page.data.filter((thread) => !current.some((item) => item.id === thread.id))])
      setCursor(page.meta.next_cursor)
    } catch (reason) {
      if (signal?.aborted) return
      if (accessError(reason)) { setThreads([]); setDenied(true) }
      setError(courierError(reason))
    } finally { moreBusy.current = false; if (!signal?.aborted) setMoreLoading(false) }
  }

  const selected = Boolean(conversationId || orderId)
  const entries: ChatEntry[] = threads.map((thread) => ({
    id: thread.id,
    title: `Courier · Order ${thread.order_reference}`,
    preview: thread.last_message_preview ?? '',
    activity: null,
    unread: thread.unread_count,
    context: 'First-mile pickup',
    selected: conversationId === thread.id,
    readOnly: !thread.send_allowed,
    onSelect: () => setParams({ conversation: thread.id }, { replace: true }),
  }))
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-7 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold sm:text-2xl">Courier messages</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Coordinate accepted first-mile pickups. Customer and Logistics conversations stay in their own inboxes.
        </p>
        <p className="text-sm">{unread} unread {unread === 1 ? 'message' : 'messages'}</p>
      </header>
      {!online && <p className="text-sm" role="status">You are offline. Messages will refresh when you reconnect.</p>}
      <ChatWorkspace
        entries={entries}
        selected={selected && !denied}
        inboxTitle={`First-mile conversations · ${unread} unread`}
        inboxStatus={loading && !threads.length ? <p className="p-4 text-sm text-zinc-500" role="status">Loading inbox…</p> : null}
        inboxError={error || undefined}
        onRetryInbox={onUpdated}
        canLoadMore={Boolean(cursor)}
        loadingMore={moreLoading}
        onLoadMore={() => void loadMore()}
        onBack={() => setParams({}, { replace: true })}
      >
        {selected && !denied ? (
          <CourierThread
            key={conversationId ?? orderId}
            conversationId={conversationId}
            orderId={orderId}
            onUpdated={onUpdated}
            onStarted={onStarted}
          />
        ) : (
          <p className="grid min-h-full place-items-center p-5 text-center text-sm text-zinc-600 dark:text-zinc-400">
            {denied ? 'This Courier conversation is unavailable to your account.' : 'Select a Courier conversation, or open an eligible Order to start one.'}
          </p>
        )}
      </ChatWorkspace>
    </div>
  )
}
