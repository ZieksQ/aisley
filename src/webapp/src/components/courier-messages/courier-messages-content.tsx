"use client";

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from "@/components/auth/auth-provider"
import { CourierThread } from "./courier-thread"
import { courierError, useCourierAccess } from "./use-courier-access"
import { useCourierOnline, useCourierRefresh } from "./use-courier-refresh"
import { courierMessages, type CourierConversation } from "@/lib/courier-messages"

type Props = { conversationId: string | null; orderId: string | null }

export function CourierMessagesContent(props: Props) {
  const { auth } = useAuth()
  if (auth.status !== 'authenticated') return <p role="status">Checking your account…</p>
  return <CourierInbox key={auth.customer.id} {...props} />
}

function CourierInbox({ conversationId, orderId }: Props) {
  const router = useRouter()
  const accessError = useCourierAccess()
  const [threads, setThreads] = useState<CourierConversation[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [unread, setUnread] = useState(0)
  const online = useCourierOnline()
  const [revision, setRevision] = useState(0)
  const initialized = useRef(false)
  const requestSignal = useRef<AbortSignal | null>(null)
  const moreBusy = useRef(false)
  const onUpdated = useCallback(() => setRevision((value) => value + 1), [])
  const onStarted = useCallback((id: string) => router.replace(`/courier-messages?conversation=${encodeURIComponent(id)}`), [router])

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
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold sm:text-2xl">Courier messages</h1>
        <p className="text-sm text-zinc-600">
          Coordinate accepted final-mile deliveries. Shop and Logistics conversations stay in their own inboxes.
        </p>
        <p className="text-sm">{unread} unread {unread === 1 ? 'message' : 'messages'}</p>
      </header>
      {!online && <p className="text-sm" role="status">You are offline. Messages will refresh when you reconnect.</p>}
      {selected && (
        <Link className="inline-flex min-h-11 items-center text-sm underline focus-visible:outline-2 lg:hidden" href="/courier-messages">
          Back to Courier inbox
        </Link>
      )}
      {error && (
        <div className="space-y-2">
          <p className="text-sm text-red-700" role="alert">{error}</p>
          <button className="min-h-11 text-sm underline focus-visible:outline-2" onClick={onUpdated} type="button">Refresh inbox</button>
        </div>
      )}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section className={`${selected ? 'hidden lg:block' : ''} min-w-0 rounded-lg border border-zinc-200 bg-white`} aria-label="Courier inbox">
          <h3 className="border-b border-zinc-200 p-4 font-semibold">Final-mile conversations</h3>
          {loading && <p className="p-4 text-sm" role="status">Loading inbox…</p>}
          {!loading && !error && !threads.length && (
            <p className="p-4 text-sm text-zinc-600">
              No Courier conversations yet. Open an Order after its final-mile delivery is accepted to send the first message.
            </p>
          )}
          <ul className="max-h-[65vh] overflow-y-auto">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  aria-current={conversationId === thread.id ? 'page' : undefined}
                  className={`block space-y-1 border-b border-zinc-200 p-4 text-sm focus-visible:outline-2 focus-visible:outline-[#E6007A] ${conversationId === thread.id ? 'bg-[#4C1268]/5' : 'hover:bg-zinc-50'}`}
                  href={`/courier-messages?conversation=${thread.id}`}
                >
                  <span className="block break-all font-medium">Order {thread.order_reference}</span>
                  <span className="block truncate text-zinc-600">{thread.last_message_preview}</span>
                  <span className="block text-xs text-zinc-500">
                    {thread.unread_count} unread · {thread.send_allowed ? 'Delivery active' : 'Read-only'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {cursor && (
            <button className="m-4 min-h-11 text-sm underline focus-visible:outline-2 disabled:opacity-50" disabled={moreLoading} onClick={() => void loadMore()} type="button">
              {moreLoading ? 'Loading…' : 'Load more conversations'}
            </button>
          )}
        </section>
        {selected && !denied ? (
          <CourierThread
            key={conversationId ?? orderId}
            conversationId={conversationId}
            orderId={orderId}
            onUpdated={onUpdated}
            onStarted={onStarted}
          />
        ) : (
          <p className="rounded-lg border border-zinc-200 p-5 text-sm text-zinc-600">
            Select a Courier conversation to view its history.
          </p>
        )}
      </div>
    </div>
  )
}
