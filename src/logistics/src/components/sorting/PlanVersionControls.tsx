import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import { sortingMutation } from '../../lib/sortingApi'
import { ErrorNotice, field, manilaDate } from '../PickupUi'
import { SortingButton } from './SortingButton'
import { VersionMappings } from './VersionMappings'
import type { SortingLane, SortingPlan } from '../../types/sorting'

type Attempt = { action: string; body: string; key: string }

export function PlanVersionControls({ plan, lanes, hubs, onChanged, onBlocked }: {
  plan: SortingPlan
  lanes: SortingLane[]
  hubs: Array<{ id: string; name: string }>
  onChanged: (id?: string) => Promise<void>
  onBlocked: (blocked: boolean) => void
}) {
  const [versionId, setVersionId] = useState('')
  const [name, setName] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const attempt = useRef<Attempt | null>(null)
  useEffect(() => { onBlocked(busy || uncertain) }, [busy, uncertain, onBlocked])
  const selected = plan.versions.find((version) => version.id === versionId) ?? plan.versions[0]

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
    try {
      const response = await sortingMutation<{ data: { plan_id: string; activation?: { status: string; failure_reason: string | null } } }>({
        path: `/api/v1/logistics/sorting/plans/${plan.id}/actions/${pending.action}`,
        key: pending.key,
        body: pending.body,
      })
      attempt.current = null
      setUncertain(false)
      setNotice(response.data.activation?.status === 'failed' ? `Activation failed: ${response.data.activation.failure_reason}` : 'Plan action recorded.')
      await onChanged(response.data.plan_id)
    } catch (caught) {
      const unknown = !(caught instanceof ApiError) || caught.status === 408 || caught.status === 0 || caught.status >= 500
      setUncertain(unknown)
      if (!unknown) attempt.current = null
      setError(caught instanceof Error ? caught.message : 'The plan action could not be confirmed.')
    } finally { setBusy(false) }
  }

  const blocked = busy || uncertain || Boolean(plan.archived_at)
  return <section className="space-y-3 border-t border-zinc-200 pt-3 dark:border-white/10" aria-label="Plan versions">


    <h4 className="font-semibold">
      Published versions
    </h4>

    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      {plan.draft_dirty ? 'Draft has unpublished changes.' : 'Published mappings are preserved. Edit to create a successor draft.'} Active version: {plan.versions.find((version) => version.id === plan.active_version_id)?.number ?? 'None'}.
    </p>
    {error ? <ErrorNotice message={error} /> : null}
    {uncertain ? <SortingButton disabled={busy} onClick={() => void perform('', {}, true)}>
      Verify previous action
    </SortingButton> : null}
    {notice ? <p role="status" className="text-sm">
      {notice}
    </p> : null}

    <div className="flex flex-wrap gap-2">


      <SortingButton disabled={blocked || !plan.draft_dirty} onClick={() => void perform('publish')}>
        Publish draft
      </SortingButton>

      <SortingButton disabled={blocked || !plan.draft_dirty} onClick={() => { if (window.confirm('Publish this draft and activate it for new scans now?')) void perform('publish', { activate: true }) }}>
        Publish and activate
      </SortingButton>

      <SortingButton disabled={blocked || plan.draft_dirty || !selected} onClick={() => void perform('draft', { version_id: selected?.id })}>
        Create successor draft
      </SortingButton>

    </div>
    {plan.versions.length ? <>
      <label className="block text-sm">
        Version
        <select className={`${field} mt-1`} disabled={busy || uncertain} value={selected?.id ?? ''} onChange={(event) => setVersionId(event.target.value)}>
          {plan.versions.map((version) => <option key={version.id} value={version.id}>
            Version {version.number} · {manilaDate(version.published_at)}
          </option>)}
        </select>
      </label>
      <p className="break-all text-xs text-zinc-500">
        Published by {selected?.published_by}. {selected?.mappings.length} destination mappings.
      </p>
      <VersionMappings version={selected} lanes={lanes} hubs={hubs} />
      <SortingButton disabled={blocked} onClick={() => { if (window.confirm(`Activate version ${selected.number} for new scans now?`)) void perform('activate', { version_id: selected.id }) }}>
        Activate selected version
      </SortingButton>
      <form className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void perform('duplicate', { version_id: selected.id, name }) }}>


        <label className="text-sm">
          Duplicate plan name
          <input className={`${field} mt-1`} required minLength={2} maxLength={80} value={name} disabled={blocked} onChange={(event) => setName(event.target.value)} />
        </label>
        <SortingButton type="submit" disabled={blocked}>
          Duplicate plan
        </SortingButton>

      </form>
    </> : <p className="text-sm text-zinc-500">
      No published versions yet.
    </p>}

    <form className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); void perform(plan.draft_dirty ? 'publish' : 'schedule', { ...(plan.draft_dirty ? {} : { version_id: selected?.id }), scheduled_for: `${time}:00+08:00` }) }}>


      <label className="text-sm">
        One-time activation (Asia/Manila)
        <input className={`${field} mt-1`} type="datetime-local" required value={time} disabled={blocked} onChange={(event) => setTime(event.target.value)} />
      </label>
      <SortingButton type="submit" disabled={blocked || (!plan.draft_dirty && !selected)}>
        Schedule activation
      </SortingButton>

    </form>

    <ul className="space-y-2 text-sm" aria-label="Activation history">
      {plan.activations.map((activation) => <li className="border-t border-zinc-200 pt-2 dark:border-white/10" key={activation.id}>
        <p>
          {manilaDate(activation.scheduled_for)} · {activation.status}
        </p>
        <p className="break-all text-xs text-zinc-500">
          Requested by {activation.requested_by}{activation.completed_at ? ` · Completed ${manilaDate(activation.completed_at)}` : ''}
        </p>{activation.failure_reason ? <p role="status">
          {activation.failure_reason}
        </p> : null}{activation.status === 'scheduled' ? <SortingButton disabled={blocked} onClick={() => { if (window.confirm('Cancel this scheduled activation?')) void perform('cancel', { activation_id: activation.id }) }}>
          Cancel schedule
        </SortingButton> : null}
      </li>)}
    </ul>

    <SortingButton disabled={blocked || plan.is_active} onClick={() => { if (window.confirm(`Archive ${plan.name}? Its versions and history will remain readable.`)) void perform('archive') }}>
      Archive plan
    </SortingButton>

  </section>
}
