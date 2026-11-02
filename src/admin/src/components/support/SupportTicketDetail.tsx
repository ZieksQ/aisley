import { TicketViewport, TicketHistory, ticketStatusLabel } from '@aisley/ui/chat'
import '../../../../../packages/support-tickets/src/workspace.css'
import { useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import type { TicketDetail, TicketStatus } from '@aisley/support-tickets'
import {
  assignSupportTicket,
  changeSupportTicketStatus,
  claimSupportTicket,
  replyToSupportTicket,
  type SupportAssignee,
} from '../../lib/supportTickets'

type Attempt = {
  kind: 'claim' | 'assign' | 'reply' | 'status'
  key: string
  revision: number
  assigneeId?: string | null
  body?: string
  status?: TicketStatus
  reason?: string
}

const actionClass = 'min-h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5'
const inputClass = 'min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 focus-visible:outline-2 focus-visible:outline-[#4C1268] dark:border-white/20 dark:bg-[#211c25] dark:text-white dark:focus-visible:outline-[#C4B5FD]'

export function SupportTicketDetail({ detail, assignees, canManage, onChanged, onLoadOlder, loadingOlder }: {
  detail: TicketDetail
  assignees: SupportAssignee[]
  canManage: boolean
  onChanged: () => void
  onLoadOlder: () => void
  loadingOlder: boolean
}) {
  const ticket = detail.data
  const [reply, setReply] = useState('')
  const [assigneeId, setAssigneeId] = useState(ticket.assignee_id ?? '')
  const [targetStatus, setTargetStatus] = useState<TicketStatus>(ticket.status === 'resolved' ? 'open' : 'waiting_for_requester')
  const [reason, setReason] = useState('')
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previousId = useRef(ticket.id)
  const dirty = Boolean(reply || reason || assigneeId !== (ticket.assignee_id ?? ''))
  const blocker = useBlocker(() => dirty || busy || uncertain)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (!busy && !uncertain && window.confirm('Discard your unsaved ticket changes?')) blocker.proceed()
    else blocker.reset()
  }, [blocker, busy, uncertain])
  useEffect(() => {
    if (!dirty && !busy && !uncertain) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, busy, uncertain])


  useEffect(() => {
    if (previousId.current === ticket.id) return
    previousId.current = ticket.id
    setReply('')
    setAssigneeId(ticket.assignee_id ?? '')
    setTargetStatus(ticket.status === 'resolved' ? 'open' : 'waiting_for_requester')
    setReason('')
    setAttempt(null)
    setUncertain(false)
    setError(null)
  }, [ticket.id, ticket.status, ticket.assignee_id])

  useEffect(() => {
    setTargetStatus(ticket.status === 'resolved' ? 'open' : 'waiting_for_requester')
  }, [ticket.status])

  async function execute(current: Attempt) {
    setAttempt(current)
    setBusy(true)
    setError(null)
    try {
      switch (current.kind) {
        case 'claim': await claimSupportTicket(ticket.id, current.revision, current.key); break
        case 'assign': await assignSupportTicket(ticket.id, current.assigneeId ?? null, current.revision, current.key); break
        case 'reply': await replyToSupportTicket(ticket.id, current.body ?? '', current.revision, current.key); break
        case 'status': await changeSupportTicketStatus(ticket.id, current.status ?? 'open', current.reason ?? '', current.revision, current.key); break
      }
      if (current.kind === 'reply') setReply('')
      if (current.kind === 'status') setReason('')
      setAttempt(null)
      setUncertain(false)
      onChanged()
    } catch (caught) {
      const status = (caught as { status?: number }).status
      setUncertain(!status || status === 408 || status >= 500)
      setError(caught instanceof Error ? caught.message : 'The action could not be saved.')
      if (status === 409) { setAttempt(null); onChanged() }
    } finally {
      setBusy(false)
    }
  }

  function submit(kind: Attempt['kind'], extra: Partial<Attempt> = {}) {
    if (busy || uncertain) return
    void execute({ kind, key: crypto.randomUUID(), revision: ticket.revision, ...extra })
  }

  return <TicketViewport label="Ticket detail" className="admin-ticket-detail">
    <header>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="break-all text-xs text-slate-500 dark:text-slate-400">{ticket.reference}</p>
        <h2 className="mt-1 break-words text-lg font-semibold">{ticket.subject}</h2>
      </div>
      <span className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold dark:border-white/20">{ticketStatusLabel(ticket.status)}</span>
    </div>
    <dl className="admin-ticket-metadata">
      <div><dt>Requester</dt><dd>{ticket.requester_name ?? 'Requester'} · {ticket.requester_role}</dd></div>
      <div><dt>Category</dt><dd>{ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1)}</dd></div>
      <div><dt>Assigned to</dt><dd>{ticket.assignee_name ?? 'Unassigned'}</dd></div>
    </dl>
    {error && <p className="mt-4 border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/30 dark:text-red-200" role="alert">{error}</p>}
    {uncertain && attempt && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span>The result is unconfirmed. Retry the same action safely.</span>
      <button className={actionClass} disabled={busy} onClick={() => void execute(attempt)} type="button">Retry action</button>
      <button className={actionClass} disabled={busy} onClick={() => { setAttempt(null); setUncertain(false) }} type="button">Discard attempt</button>
    </div>}

    </header>
    <div className="admin-ticket-body">
    <div className="admin-ticket-conversation">
    <TicketHistory key={ticket.id} events={detail.events} hasOlder={Boolean(detail.next_cursor)} loadingOlder={loadingOlder} onLoadOlder={onLoadOlder} />
    {canManage ? <form onSubmit={(event) => { event.preventDefault(); submit('reply', { body: reply.trim() }) }}>
        <label className="text-sm font-semibold" htmlFor="admin-ticket-reply">Public reply</label>
        <textarea
          className={`${inputClass} mt-2 min-h-20 py-2`}
          disabled={busy || uncertain || ticket.status === 'resolved'}
          id="admin-ticket-reply"
          maxLength={2000}
          onChange={(event) => setReply(event.target.value)}
          required
          value={reply}
        />
        <div className="support-ticket-hint mt-1">{reply.length}/2,000{ticket.status === 'resolved' ? ' · Reopen this ticket to reply.' : ''}</div>
        <button className={`${actionClass} mt-2`} disabled={busy || uncertain || ticket.status === 'resolved' || !reply.trim()} type="submit">Send reply</button>
      </form> : <p className="support-ticket-hint p-4">You have view-only access to this ticket.</p>}
    </div>
    {canManage && <div className="admin-ticket-management">
      <div>
        <h3 className="text-sm font-semibold">Assignment</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {!ticket.assignee_id && <button className={actionClass} disabled={busy || uncertain} onClick={() => submit('claim')} type="button">
            Claim ticket
          </button>}
          <label className="min-w-48 flex-1 text-xs">Assign to
            <select className={`${inputClass} mt-1`} disabled={busy || uncertain} onChange={(event) => setAssigneeId(event.target.value)} value={assigneeId}>
              <option value="">Unassigned</option>
              {assignees.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}</option>)}
            </select>
          </label>
          <button
            className={`${actionClass} self-end`}
            disabled={busy || uncertain || assigneeId === (ticket.assignee_id ?? '')}
            onClick={() => submit('assign', { assigneeId: assigneeId || null })}
            type="button"
          >Save assignment</button>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Change status</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="text-xs">New status
            <select className={`${inputClass} mt-1`} disabled={busy || uncertain} onChange={(event) => setTargetStatus(event.target.value as TicketStatus)} value={targetStatus}>
              {ticket.status === 'resolved' ? <option value="open">Reopen</option> : <>
                <option value="in_progress">In progress</option>
                <option value="waiting_for_requester">Waiting for requester</option>
                <option value="resolved">Resolved</option>
              </>}
            </select>
          </label>
          <button
            className={`${actionClass} self-end`}
            disabled={busy || uncertain || targetStatus === ticket.status || (targetStatus !== 'in_progress' && !reason.trim())}
            onClick={() => submit('status', { status: targetStatus, reason: reason.trim() })}
            type="button"
          >Save status</button>
        </div>
        <label className="mt-2 block text-xs" htmlFor="admin-ticket-reason">Visible reason {targetStatus === 'in_progress' ? '(optional)' : '(required)'}</label>
        <textarea className={`${inputClass} mt-1 min-h-20 py-2`} disabled={busy || uncertain} id="admin-ticket-reason" maxLength={2000} onChange={(event) => setReason(event.target.value)} value={reason} />
      </div>
    </div>}
    </div>
  </TicketViewport>
}
