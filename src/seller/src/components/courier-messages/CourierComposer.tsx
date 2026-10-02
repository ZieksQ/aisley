import { useEffect, useRef, useState } from 'react'
import { Button } from '@aisley/ui'
import { ApiError } from '../../lib/api'
import { courierMessages, type CourierSendResult } from '../../lib/courierMessages'
import { courierError } from './useCourierAccess'

type Props = {
  conversationId: string | null
  orderId: string | null
  allowed: boolean
  onSaved: (result: CourierSendResult) => void
  onConflict: () => void
  onAccessError: (error: unknown) => boolean
}

export function CourierComposer({ conversationId, orderId, allowed, onSaved, onConflict, onAccessError }: Props) {
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [online, setOnline] = useState(navigator.onLine)
  const pending = useRef<{ body: string; key: string } | null>(null)
  const alive = useRef(true)
  const busy = useRef(false)
  useEffect(() => {
    alive.current = true
    const sync = () => setOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      alive.current = false
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  async function send() {
    // Retry an uncertain send even after an observed handoff: the server can replay it.
    if (busy.current || !online || (!allowed && !pending.current) || !body.trim()) return
    pending.current ??= { body: body.trim(), key: crypto.randomUUID() }
    busy.current = true
    setSending(true)
    setError('')
    try {
      const result = await courierMessages.send(conversationId, orderId, pending.current.body, pending.current.key)
      if (!alive.current) return
      pending.current = null
      setUncertain(false)
      setBody('')
      onSaved(result)
    } catch (reason) {
      if (!alive.current) return
      if (onAccessError(reason)) { pending.current = null; setBody(''); setUncertain(false); return }
      const definitive = reason instanceof ApiError && [409, 419, 422].includes(reason.status)
      if (definitive) { pending.current = null; setUncertain(false) }
      else setUncertain(true)
      setError(definitive ? courierError(reason) : `${courierError(reason)} Delivery is unconfirmed. Retry this same message; it will not be duplicated.`)
      if (reason instanceof ApiError && reason.status === 409) onConflict()
    } finally {
      busy.current = false
      if (alive.current) setSending(false)
    }
  }

  return (
    <form
      className="space-y-3 border-t border-zinc-200 p-4 dark:border-white/10"
      onSubmit={(event) => { event.preventDefault(); void send() }}
    >
      {!allowed && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This pickup is not open for messaging. Existing history is read-only.
        </p>
      )}
      {!online && <p role="status" className="text-sm">You are offline. Your draft stays here until you reconnect.</p>}
      <label className="block text-sm font-medium" htmlFor="courier-message">Message to Courier</label>
      <textarea
        id="courier-message"
        className="min-h-28 w-full resize-y rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-950 focus-visible:outline-2 focus-visible:outline-[#E6007A] disabled:opacity-60 dark:border-white/20 dark:bg-[#101012] dark:text-white"
        disabled={sending || uncertain || !allowed}
        maxLength={2000}
        onChange={(event) => setBody(event.target.value)}
        value={body}
        aria-describedby="courier-message-help"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="courier-message-help" className="text-xs text-zinc-500 dark:text-zinc-400">
          Plain text only · {body.length}/2,000
        </p>
        <Button
          className="min-h-11! rounded-lg! px-4! shadow-none! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
          type="submit"
          disabled={!online || (!allowed && !uncertain) || !body.trim()}
          isLoading={sending}
          loadingLabel="Sending"
        >
          {uncertain ? 'Retry same message' : 'Send message'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>}
    </form>
  )
}
