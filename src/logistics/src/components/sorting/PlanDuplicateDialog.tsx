import { useEffect, useRef, useState } from 'react'
import { FaRegCopy, FaXmark } from 'react-icons/fa6'
import { ApiError } from '../../lib/api'
import { sortingMutation } from '../../lib/sortingApi'
import type { SortingPlan } from '../../types/sorting'
import { ErrorNotice } from '../PickupUi'
import { SortingButton } from './SortingButton'

export function PlanDuplicateDialog({ plan, onClose, onBlocked, onCopied }: {
  plan: SortingPlan | null
  onClose: () => void
  onBlocked: (blocked: boolean) => void
  onCopied: (id: string, message: string) => Promise<void>
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const attempt = useRef<{ path: string; key: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { onBlocked(busy || uncertain) }, [busy, uncertain, onBlocked])
  useEffect(() => {
    if (plan) dialog.current?.showModal()
    else dialog.current?.close()
  }, [plan])

  function close() {
    if (busy || uncertain) return
    setError('')
    onClose()
  }

  async function duplicate() {
    if (!plan || busy) return
    const version = plan.versions[0]
    attempt.current ??= {
      path: `/api/v1/logistics/sorting/plans/${plan.id}/actions/duplicate`,
      key: crypto.randomUUID(),
      body: JSON.stringify({ expected_revision: plan.revision, ...(version ? { version_id: version.id } : {}) }),
    }
    setBusy(true)
    setError('')
    try {
      const response = await sortingMutation<{ data: { plan_id: string; plan_name: string } }>(attempt.current)
      attempt.current = null
      setUncertain(false)
      onClose()
      await onCopied(response.data.plan_id, `${response.data.plan_name} created.`)
    } catch (caught) {
      const unknown = !(caught instanceof ApiError) || caught.status === 408 || caught.status === 0 || caught.status >= 500
      setUncertain(unknown)
      if (!unknown) attempt.current = null
      setError(caught instanceof Error ? caught.message : 'The copy could not be confirmed.')
    } finally { setBusy(false) }
  }

  return (
    <dialog ref={dialog} aria-labelledby="duplicate-plan-title" className="m-auto max-h-[90dvh] w-[min(92vw,28rem)] overflow-y-auto rounded-md border border-zinc-300 bg-white p-0 text-zinc-950 backdrop:bg-black/50 dark:border-white/20 dark:bg-zinc-900 dark:text-white" onCancel={(event) => { event.stopPropagation(); event.preventDefault(); close() }} onClose={(event) => event.stopPropagation()}>

      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-white/10">

        <h3 id="duplicate-plan-title" className="font-semibold">
          Duplicate plan?
        </h3>

        <button type="button" aria-label="Close duplicate confirmation" disabled={busy || uncertain} className="grid size-9 place-items-center rounded-md hover:bg-zinc-100 focus-visible:outline-2 disabled:opacity-40 dark:hover:bg-white/10" onClick={close}>
          <FaXmark aria-hidden="true" />
        </button>

      </div>

      <div className="space-y-3 p-4 text-sm">

        <p className="break-words">
          Copy {plan?.name}{plan?.versions[0] ? `, published version ${plan.versions[0].number}` : "'s draft"} into a new inactive draft?
        </p>

        <p>
          The copy uses the same name with a number, such as “{plan?.name.replace(/\s+\(\d+\)$/, '')} (1)”. Existing copy numbers are incremented. Physical lanes are shared.
        </p>
        {error ? <ErrorNotice message={error} /> : null}
        {uncertain ? <p>
          Verify the previous request to confirm whether the copy was created.
        </p> : null}

      </div>

      <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3 dark:border-white/10">

        <SortingButton disabled={busy || uncertain} onClick={close}>
          Cancel
        </SortingButton>

        <SortingButton disabled={busy} onClick={() => void duplicate()}>
          <FaRegCopy aria-hidden="true" />{busy ? 'Copying…' : uncertain ? 'Verify previous copy' : 'Duplicate plan'}
        </SortingButton>

      </div>

    </dialog>
  )
}
