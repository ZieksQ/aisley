"use client";

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChatWorkspace, type ChatEntry } from '@aisley/chat-ui'
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
  const entries: ChatEntry[] = threads.map((thread) => ({
    id: thread.id,
    title: `Courier · Order ${thread.order_reference}`,
    preview: thread.last_message_preview ?? '',
    activity: null,
    unread: thread.unread_count,
    context: 'Final-mile delivery',
    selected: conversationId === thread.id,
    readOnly: !thread.send_allowed,
    onSelect: () => router.push(`/courier-messages?conversation=${encodeURIComponent(thread.id)}`),
  }))
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
      <ChatWorkspace
        entries={entries}
        selected={selected && !denied}
        inboxTitle={`Final-mile conversations · ${unread} unread`}
        inboxStatus={loading && !threads.length ? <p className="p-4 text-sm text-zinc-500" role="status">Loading inbox…</p> : null}
        inboxError={error || undefined}
        onRetryInbox={onUpdated}
        canLoadMore={Boolean(cursor)}
        loadingMore={moreLoading}
        onLoadMore={() => void loadMore()}
        onBack={() => router.replace('/courier-messages')}
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
