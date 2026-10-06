import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import { sortingMutation } from '../../lib/sortingApi'
import { ErrorNotice, field, manilaDate } from '../PickupUi'
import { SortingButton } from './SortingButton'
import { PublishedVersions } from './PublishedVersions'
import { TimedNotice } from './TimedNotice'
import type { SortingLane, SortingPlan } from '../../types/sorting'

type Attempt = { action: string; body: string; key: string }

export function PlanVersionControls({ plan, lanes, hubs, onChanged, onBlocked }: {
  plan: SortingPlan
  lanes: SortingLane[]
  hubs: Array<{ id: string; name: string }>
  onChanged: (id?: string) => Promise<void>
  onBlocked: (blocked: boolean) => void
}) {
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const attempt = useRef<Attempt | null>(null)
  useEffect(() => { onBlocked(busy || uncertain) }, [busy, uncertain, onBlocked])

  async function perform(action: string, fields: Record<string, unknown> = {}, replay = false) {
    if (busy) return
    if (!replay) {
      if (uncertain) return
      attempt.current = { action, body: JSON.stringify({ expected_revision: plan.revision, ...fields }), key: crypto.randomUUID() }
    }
    if (!attempt.current) return
    const pending = attempt.current
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await sortingMutation<{ data: { plan_id: string; activation?: { status: string; failure_reason: string | null } } }>({
        path: `/api/v1/logistics/sorting/plans/${plan.id}/actions/${pending.action}`,
        key: pending.key,
        body: pending.body,
      })
      attempt.current = null
      setUncertain(false)
      if (response.data.activation?.status === 'failed') setError(`Activation failed: ${response.data.activation.failure_reason}`)
      else setNotice('Plan action recorded.')
      await onChanged(response.data.plan_id)
    } catch (caught) {
      const unknown = !(caught instanceof ApiError) || caught.status === 408 || caught.status === 0 || caught.status >= 500
      setUncertain(unknown)
      if (!unknown) attempt.current = null
      setError(caught instanceof Error ? caught.message : 'The plan action could not be confirmed.')
    } finally { setBusy(false) }
  }

  const blocked = busy || uncertain || Boolean(plan.archived_at)
  const feedback = <>
    {error ? <ErrorNotice message={error} /> : null}
    {uncertain ? <SortingButton disabled={busy} onClick={() => void perform('', {}, true)}>
      Verify previous action
    </SortingButton> : null}
    <TimedNotice message={notice} onChange={setNotice} />
  </>

  return <section className="space-y-3 border-t border-zinc-200 pt-3 dark:border-white/10" aria-label="Plan publication">

    <h4 className="font-semibold">
      Draft publication
    </h4>

    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      {plan.draft_dirty ? 'Draft has unpublished changes.' : 'Draft matches the latest publication.'} Active version: {plan.versions.find((version) => version.id === plan.active_version_id)?.number ?? 'None'}.
    </p>
    {feedback}

    <div className="flex flex-wrap gap-2">

      <SortingButton disabled={blocked || !plan.draft_dirty} onClick={() => void perform('publish')}>
        Publish draft
      </SortingButton>

      <SortingButton disabled={blocked || !plan.draft_dirty} onClick={() => { if (window.confirm('Publish this draft and activate it for new scans now?')) void perform('publish', { activate: true }) }}>
        Publish and activate
      </SortingButton>

      <PublishedVersions plan={plan} lanes={lanes} hubs={hubs} blocked={busy || uncertain} feedback={feedback} actions={(version) => <>
        <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-3 dark:border-white/10">

          <SortingButton disabled={blocked || version.id === plan.active_version_id} onClick={() => { if (window.confirm(`Activate version ${version.number} for new scans now?`)) void perform('activate', { version_id: version.id }) }}>
            Activate selected version
          </SortingButton>

          <SortingButton disabled={blocked || plan.draft_dirty} onClick={() => void perform('draft', { version_id: version.id })}>
            Create successor draft
          </SortingButton>

        </div>
        <form className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void perform('schedule', { version_id: version.id, scheduled_for: `${time}:00+08:00` }) }}>

          <label className="text-sm">
            One-time activation (Asia/Manila)
            <input className={`${field} mt-1`} type="datetime-local" required value={time} disabled={blocked} onChange={(event) => setTime(event.target.value)} />
          </label>

          <SortingButton type="submit" disabled={blocked}>
            Schedule activation
          </SortingButton>

        </form>
      </>} />

    </div>
    {plan.draft_dirty ? <form className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void perform('publish', { scheduled_for: `${time}:00+08:00` }) }}>

      <label className="text-sm">
        One-time activation (Asia/Manila)
        <input className={`${field} mt-1`} type="datetime-local" required value={time} disabled={blocked} onChange={(event) => setTime(event.target.value)} />
      </label>

      <SortingButton type="submit" disabled={blocked}>
        Publish and schedule
      </SortingButton>

    </form> : null}
    {plan.activations.length ? <section className="space-y-2" aria-label="Activation history">

      <h4 className="font-semibold">
        Activation history
      </h4>

      <ul className="divide-y divide-zinc-200 text-sm dark:divide-white/10">
        {plan.activations.map((activation) => <li className="space-y-1 py-2" key={activation.id}>

          <p>
            {manilaDate(activation.scheduled_for)} · {activation.status}
          </p>

          <p className="break-all text-xs text-zinc-600 dark:text-zinc-400">
            Requested by {activation.requested_by}{activation.completed_at ? ` · Completed ${manilaDate(activation.completed_at)}` : ''}
          </p>
          {activation.failure_reason ? <p>
            {activation.failure_reason}
          </p> : null}
          {activation.status === 'scheduled' ? <SortingButton disabled={blocked} onClick={() => { if (window.confirm('Cancel this scheduled activation?')) void perform('cancel', { activation_id: activation.id }) }}>
            Cancel schedule
          </SortingButton> : null}

        </li>)}

      </ul>

    </section> : null}

    <SortingButton disabled={blocked || plan.is_active} onClick={() => { if (window.confirm(`Archive ${plan.name}? Its versions and history will remain readable.`)) void perform('archive') }}>
      Archive plan
    </SortingButton>

  </section>
}
