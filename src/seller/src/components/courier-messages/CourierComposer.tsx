import { useEffect, useRef, useState } from 'react'
import { ChatComposer, readChatAttempt, readChatDraft, writeChatAttempt, writeChatDraft } from '@aisley/chat-ui'
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
  const draftKey = `seller-courier:${conversationId ?? orderId ?? 'inbox'}`
  const pending = useRef(readChatAttempt(draftKey))
  const [body, setBody] = useState(() => pending.current?.body ?? readChatDraft(draftKey))
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [uncertain, setUncertain] = useState(() => Boolean(pending.current))
  const [online, setOnline] = useState(navigator.onLine)
  const alive = useRef(true)
  const busy = useRef(false)
  useEffect(() => { writeChatDraft(draftKey, body) }, [body, draftKey])
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
    writeChatAttempt(draftKey, pending.current)
    busy.current = true
    setSending(true)
    setError('')
    try {
      const result = await courierMessages.send(conversationId, orderId, pending.current.body, pending.current.key)
      if (!alive.current) return
      pending.current = null
      writeChatAttempt(draftKey, null)
      setUncertain(false)
      setBody('')
      writeChatDraft(draftKey, '')
      onSaved(result)
    } catch (reason) {
      if (!alive.current) return
      if (onAccessError(reason)) { pending.current = null; setBody(''); writeChatAttempt(draftKey, null); writeChatDraft(draftKey, ''); setUncertain(false); return }
      const definitive = reason instanceof ApiError && [409, 419, 422, 429].includes(reason.status)
      if (definitive) { pending.current = null; writeChatAttempt(draftKey, null); setUncertain(false) }
      else setUncertain(true)
      setError(definitive ? courierError(reason) : `${courierError(reason)} Delivery is unconfirmed. Retry this same message; it will not be duplicated.`)
      if (reason instanceof ApiError && reason.status === 409) onConflict()
    } finally {
      busy.current = false
      if (alive.current) setSending(false)
    }
  }

  return <ChatComposer
    id="courier-message"
    recipient="Courier"
    value={body}
    onChange={(value) => { setBody(value); setError(''); writeChatDraft(draftKey, value) }}
    onSubmit={() => void send()}
    sendAllowed={allowed}
    online={online}
    sending={sending}
    uncertain={uncertain && !sending}
    error={error}
    placeholder="Coordinate this pickup"
    readOnlyReason={!allowed ? 'This pickup is no longer open for messaging. Existing history remains available.' : null}
  />
}
