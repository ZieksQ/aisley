import { useState, type FormEvent } from 'react'
import { Button } from '@aisley/ui'
import type { TicketCategory, TicketClient } from './types'

const categories: { value: TicketCategory; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'account', label: 'Account' },
  { value: 'order', label: 'Order' },
  { value: 'delivery', label: 'Delivery' },
]

export function NewTicketForm({ client, onCreated }: { client: TicketClient; onCreated: (id: string) => void }) {
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>('general')
  const [body, setBody] = useState('')
  const [key, setKey] = useState<string | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const requestKey = key ?? crypto.randomUUID()
    setKey(requestKey)
    setBusy(true)
    setError(null)
    try {
      const result = await client.create({ subject: subject.trim(), category, body: body.trim() }, requestKey)
      setSubject('')
      setCategory('general')
      setBody('')
      setKey(null)
      setUncertain(false)
      onCreated(result.data.id)
    } catch (caught) {
      const status = (caught as { status?: number }).status
      setUncertain(!status || status === 408)
      setError(caught instanceof Error ? caught.message : 'The ticket could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setSubject('')
    setCategory('general')
    setBody('')
    setKey(null)
    setUncertain(false)
    setError(null)
  }

  return <form className="support-ticket-form" onSubmit={submit}>
    <h2>New support ticket</h2>
    <label htmlFor="ticket-subject">Subject</label>
    <input disabled={uncertain || busy} id="ticket-subject" maxLength={150} onChange={(event) => { setSubject(event.target.value); setKey(null) }} required value={subject} />
    <label htmlFor="ticket-category">Category</label>
    <select disabled={uncertain || busy} id="ticket-category" onChange={(event) => { setCategory(event.target.value as TicketCategory); setKey(null) }} value={category}>
      {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <label htmlFor="ticket-description">Description</label>
    <textarea disabled={uncertain || busy} id="ticket-description" maxLength={2000} minLength={1} onChange={(event) => { setBody(event.target.value); setKey(null) }} required rows={5} value={body} />
    <p className="support-ticket-hint">Please describe the issue without payment details or passwords.</p>
    {error && <p className="support-ticket-error" role="alert">{error}</p>}
    {uncertain && <p className="support-ticket-hint">The result is unconfirmed. Retry the same submission, or discard this draft.</p>}
    <div className="support-ticket-actions">
      <Button disabled={busy || subject.trim().length === 0 || body.trim().length === 0} type="submit">{busy ? 'Sending…' : uncertain ? 'Retry submission' : 'Submit ticket'}</Button>
      {uncertain && <button className="support-ticket-secondary" onClick={reset} type="button">Discard draft</button>}
    </div>
  </form>
}
