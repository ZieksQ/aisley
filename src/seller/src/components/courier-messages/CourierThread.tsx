import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { courierMessages, mergeCourierMessages, type CourierConversation, type CourierMessage, type CourierOrderContext, type CourierSendResult } from '../../lib/courierMessages'
import { CourierComposer } from './CourierComposer'
import { courierError, useCourierAccess } from './useCourierAccess'
import { useCourierRefresh } from './useCourierRefresh'

type Props = {
  conversationId: string | null
  orderId: string | null
  onUpdated: () => void
  onStarted: (id: string) => void
}

export function CourierThread({ conversationId, orderId, onUpdated, onStarted }: Props) {
  const accessError = useCourierAccess()
  const [thread, setThread] = useState<CourierConversation | null>(null)
  const [context, setContext] = useState<CourierOrderContext | null>(null)
  const [messages, setMessages] = useState<CourierMessage[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [olderLoading, setOlderLoading] = useState(false)
  const [error, setError] = useState('')
  const [readError, setReadError] = useState('')
  const [saved, setSaved] = useState(false)
  const [denied, setDenied] = useState(false)
  const [revision, setRevision] = useState(0)
  const initialized = useRef(false)
  const latestSequence = useRef(0)
  const controller = useRef<AbortSignal | null>(null)
  const olderBusy = useRef(false)
  const historyView = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const olderAnchor = useRef<{ height: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const view = historyView.current
    if (!view) return
    if (olderAnchor.current) {
      view.scrollTop = olderAnchor.current.top + view.scrollHeight - olderAnchor.current.height
      olderAnchor.current = null
    } else if (following.current) view.scrollTop = view.scrollHeight
  }, [messages, loading])

  const deny = useCallback((reason: unknown) => {
    if (!accessError(reason)) return false
    setThread(null)
    setContext(null)
    setMessages([])
    setDenied(true)
    setError(courierError(reason))
    return true
  }, [accessError])

  const refresh = useCallback(async (signal: AbortSignal) => {
    controller.current = signal
    try {
      if (!conversationId && orderId) {
        const result = await courierMessages.context(orderId, signal)
        if (signal.aborted) return
        // Only initial navigation resolves an existing thread. A subsequent poll
        // must not discard the key of a first send whose response was lost.
        if (!initialized.current && result.data.conversation_id) {
          onStarted(result.data.conversation_id)
          return
        }
        setContext(result.data)
      } else if (conversationId) {
        const [detail, history] = await Promise.all([
          courierMessages.detail(conversationId, signal), courierMessages.history(conversationId, null, signal),
        ])
        if (signal.aborted) return
        setThread(detail.data)
        setMessages((current) => mergeCourierMessages(current, history.data))
        // A long background pause may create more than one page of new messages.
        // Keep that gap reachable instead of silently skipping its middle page.
        if (!initialized.current || (history.data[0]?.sequence ?? 0) > latestSequence.current + 1) {
          setCursor(history.meta.next_cursor)
        }
        latestSequence.current = Math.max(latestSequence.current, history.data.at(-1)?.sequence ?? 0)
        const last = history.data.at(-1)?.sequence ?? 0
        if (last > detail.data.last_read_sequence && !document.hidden) {
          try {
            await courierMessages.markRead(conversationId, last)
            if (!signal.aborted) { setReadError(''); onUpdated() }
          } catch (reason) {
            if (signal.aborted) return
            if (deny(reason)) return
            setReadError('History loaded, but the read marker could not be saved. It will retry on refresh.')
          }
        }
      }
      if (!signal.aborted) { initialized.current = true; setError(''); setDenied(false) }
    } catch (reason) {
      if (!signal.aborted && !deny(reason)) setError(courierError(reason))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [conversationId, orderId, onStarted, onUpdated, deny])
  useCourierRefresh(refresh, revision)

  async function loadOlder() {
    if (!cursor || !conversationId || olderBusy.current) return
    olderBusy.current = true
    setOlderLoading(true)
    const signal = controller.current
    try {
      const page = await courierMessages.history(conversationId, cursor, signal ?? undefined)
      if (signal?.aborted) return
      if (historyView.current) {
        olderAnchor.current = { height: historyView.current.scrollHeight, top: historyView.current.scrollTop }
      }
      setMessages((current) => mergeCourierMessages(current, page.data))
      setCursor(page.meta.next_cursor)
    } catch (reason) {
      if (!signal?.aborted && !deny(reason)) setError(courierError(reason))
    } finally {
      olderBusy.current = false
      if (!signal?.aborted) setOlderLoading(false)
    }
  }

  function onSaved(result: CourierSendResult) {
    following.current = true
    setThread(result.conversation)
    setMessages((current) => mergeCourierMessages(current, [result.message]))
    setSaved(true)
    onUpdated()
    if (!conversationId) onStarted(result.conversation.id)
  }

  const order = thread?.order_id ?? context?.order_id
  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#171719]" aria-label="Courier conversation">
      <header className="space-y-2 border-b border-zinc-200 p-4 dark:border-white/10">
        <h3 className="font-semibold">Courier · First-mile pickup</h3>
        {order && (
          <Link className="inline-flex min-h-11 items-center break-all text-sm text-[#4C1268] underline underline-offset-4 focus-visible:outline-2 dark:text-[#e5bdf6]" to={`/orders/${order}`}>
            Order {thread?.order_reference ?? context?.order_reference}
          </Link>
        )}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Pickup coordination only. Messages do not confirm a handoff or change the Order.</p>
      </header>
      {loading && <p className="p-4 text-sm" role="status">Loading conversation…</p>}
      {error && (
        <div className="space-y-2 p-4">
          <p className="text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>
          <button className="min-h-11 text-sm underline focus-visible:outline-2" onClick={() => setRevision((value) => value + 1)} type="button">
            Refresh conversation
          </button>
        </div>
      )}
      {readError && <p className="p-4 text-sm" role="status">{readError}</p>}
      {!loading && !denied && <>
        <div
          ref={historyView}
          className="max-h-[55vh] min-h-36 space-y-4 overflow-y-auto p-4"
          aria-label="Message history"
          tabIndex={0}
          onScroll={(event) => {
            const view = event.currentTarget
            following.current = view.scrollHeight - view.scrollTop - view.clientHeight < 80
          }}
        >
          {cursor && (
            <button className="min-h-11 text-sm underline focus-visible:outline-2 disabled:opacity-50" disabled={olderLoading} onClick={() => void loadOlder()} type="button">
              {olderLoading ? 'Loading older messages…' : 'Load older messages'}
            </button>
          )}
          {!messages.length && <p className="text-sm text-zinc-500 dark:text-zinc-400">No messages yet. Send a message to start pickup coordination.</p>}
          <ol className="space-y-4">
            {messages.map((message) => (
              <li key={message.id} className={`max-w-[95%] rounded-lg border p-3 sm:max-w-[85%] ${message.mine ? 'ml-auto border-[#4C1268]/15 bg-[#4C1268]/5 dark:border-white/15 dark:bg-white/5' : 'border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-[#101012]'}`}>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{message.mine ? 'You' : 'Courier'}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{message.body}</p>
                <time className="mt-2 block text-xs text-zinc-500 dark:text-zinc-400" dateTime={message.created_at}>
                  {new Date(message.created_at).toLocaleString()}
                </time>
              </li>
            ))}
          </ol>
        </div>
        {saved && <p className="px-4 pb-3 text-sm" role="status">Message sent.</p>}
        <CourierComposer
          conversationId={conversationId}
          orderId={orderId}
          allowed={!error && (thread?.send_allowed ?? context?.send_allowed ?? false)}
          onSaved={onSaved}
          onConflict={() => setRevision((value) => value + 1)}
          onAccessError={deny}
        />
      </>}
    </section>
  )
}
