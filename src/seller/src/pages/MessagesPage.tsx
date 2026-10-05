import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChatWorkspace, type ChatEntry } from '@aisley/chat-ui'
import { ApiError } from '../lib/api'
import { listConversations, type Conversation } from '../lib/messages'

export function MessagesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Conversation[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const result = await listConversations()
      setItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]))
        result.items.forEach((item) => byId.set(item.id, item))
        return [...byId.values()].sort((left, right) =>
          (right.last_message_at ?? '').localeCompare(left.last_message_at ?? '') || right.id.localeCompare(left.id))
      })
      setCursor((current) => current ?? result.next_cursor)
      setError('')
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Messages could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'Messages | Aisley Seller'
    void refresh()
    const onFocus = () => { if (navigator.onLine) void refresh() }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) void refresh()
    }, 20000)
    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onFocus)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onFocus)
    }
  }, [refresh])

  async function loadMore() {
    if (!cursor) return
    setBusy(true)
    try {
      const result = await listConversations(cursor)
      setItems((current) => [...current, ...result.items.filter((item) => !current.some((entry) => entry.id === item.id))])
      setCursor(result.next_cursor)
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : 'Older conversations could not be loaded.')
    } finally {
      setBusy(false)
    }
  }

  const entries: ChatEntry[] = items.map((item) => ({
    id: item.id,
    title: item.customer_name ?? 'Customer',
    preview: item.last_message_preview ?? '',
    activity: item.last_message_at,
    unread: item.unread_count,
    context: item.shop.name,
    onSelect: () => navigate(`/messages/${item.id}`),
  }))

  return (
    <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
        <h2 className="text-2xl font-semibold">Messages</h2>
        <button className="text-sm font-medium text-[#4C1268] hover:underline dark:text-purple-300" onClick={() => void refresh()} type="button">Refresh</button>
      </div>
      <div className="mt-5">
        <ChatWorkspace
          entries={entries}
          selected={false}
          inboxTitle="Customer conversations"
          inboxStatus={loading && !items.length ? <p className="p-4 text-sm text-zinc-500" role="status">Loading conversations…</p> : null}
          inboxError={error || undefined}
          onRetryInbox={() => void refresh()}
          canLoadMore={Boolean(cursor)}
          loadingMore={busy}
          onLoadMore={() => void loadMore()}
        >
          <div className="grid min-h-full place-items-center p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">{items.length ? 'Select a conversation to read and reply.' : 'Customer conversations will appear here.'}</div>
        </ChatWorkspace>
      </div>
    </div>
  )
}
