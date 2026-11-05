import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaRoute } from 'react-icons/fa6'
import { PortalButton } from '@aisley/ui/portal'
import { ProofPhotoReview } from '../../components/ProofPhotoReview'
import type { FulfillmentEvidence } from '../../types/fulfillment'
import type { RecordDetailProps } from './RecordDetail'
import {
  completionFor,
  formatDate,
  human,
  StateLabel,
  transitionLabels,
  validEvidence,
} from './presentation'

const field = 'portal-input'

export function CustodyControls({
  actionsEnabled,
  record,
  reason,
  setReason,
  evidenceChoice,
  setEvidenceChoice,
  transitionBusy,
  onTransition,
  onProofRejected,
  finalTask,
}: RecordDetailProps) {
  const [reviewedProofId, setReviewedProofId] = useState<string | null>(null)
  const hubEvidence = validEvidence(finalTask, 'hub_pickup')
  const proofEvidence = validEvidence(finalTask, 'delivery_proof')
  const selectedHubEvidence =
    evidenceChoice.picked_up_from_hub ?? hubEvidence[0]?.id ?? ''
  const selectedProofEvidence =
    evidenceChoice.delivered ?? proofEvidence[0]?.id ?? ''
  const selectedIntent = completionFor(finalTask, selectedProofEvidence)

  function chooseEvidence(target: string, value: string) {
    setEvidenceChoice({ ...evidenceChoice, [target]: value })
  }

  function transitionControl(target: string) {
    const requiresHubEvidence = target === 'picked_up_from_hub'
    const requiresProof = target === 'delivered'
    const selectedEvidence = requiresHubEvidence
      ? selectedHubEvidence
      : requiresProof
        ? selectedProofEvidence
        : ''
    const intentMissing =
      requiresProof &&
      (!selectedIntent ||
        !['awaiting_validation', 'validated'].includes(selectedIntent.status))
    return (
      <div
        className="border-t border-slate-200 pt-3 dark:border-slate-700"
        key={target}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              {transitionLabels[target] ?? human(target)}
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Current shipment state: {human(record.status)}.
            </p>
          </div>
          <PortalButton
            variant="primary"
            isLoading={transitionBusy}
            disabled={
              !actionsEnabled ||
              ((requiresHubEvidence || requiresProof) && !selectedEvidence) ||
              intentMissing ||
              (requiresProof && reviewedProofId !== selectedProofEvidence)
            }
            onClick={() => onTransition(target, selectedEvidence || undefined)}
          >
            {transitionLabels[target] ?? human(target)}
          </PortalButton>
        </div>
        {requiresHubEvidence ? (
          <EvidenceSelector
            disabled={!actionsEnabled}
            label="Hub-pickup evidence"
            evidence={hubEvidence}
            value={selectedHubEvidence}
            onChange={(value) => chooseEvidence('picked_up_from_hub', value)}
            empty="Waiting for Courier hub-pickup submission."
          />
        ) : null}
        {requiresProof ? (
          <>
            <EvidenceSelector
              disabled={!actionsEnabled}
              label="Delivery photo POD"
              evidence={proofEvidence}
              value={selectedProofEvidence}
              onChange={(value) => chooseEvidence('delivered', value)}
              empty="Waiting for Courier photo POD."
            />
            {selectedProofEvidence &&
            proofEvidence.find((item) => item.id === selectedProofEvidence)
              ?.type === 'photo' ? (
              <ProofPhotoReview
                actionsEnabled={actionsEnabled}
                onRejected={onProofRejected}
                onViewed={setReviewedProofId}
                proofId={selectedProofEvidence}
                taskRevision={finalTask?.revision ?? 0}
              />
            ) : null}
            {selectedProofEvidence &&
            reviewedProofId !== selectedProofEvidence ? (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                Review the photo before confirming delivery.
              </p>
            ) : null}
            {intentMissing ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                A Courier completion intent for this proof is required before
                Logistics can validate delivery.
              </p>
            ) : selectedIntent ? (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                Completion intent: <StateLabel value={selectedIntent.status} />{' '}
                · confirmed {formatDate(selectedIntent.confirmed_at)}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    )
  }

  const hubTransitions = record.allowed_transitions.filter(
    (target) =>
      target !== 'received_at_hub' &&
      target !== 'sorted_at_hub' &&
      target !== 'dispatched_from_hub',
  )

  return (
    <section className="mt-5">
      <div className="flex items-center gap-2">
        <FaRoute
          className="text-blue-700 dark:text-blue-300"
          aria-hidden="true"
        />
        <h5 className="font-semibold">Custody controls</h5>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
        Receiving, sorting, and dispatch use their dedicated workspaces. This
        page retains evidence validation and delivery recovery.
      </p>
      {!actionsEnabled ? (
        <p className="mt-2 border-l-2 border-amber-500 pl-3 text-xs leading-5 text-amber-800 dark:text-amber-300">
          Controls are disabled while this is a cached or offline projection.
          Load the current server record before taking action.
        </p>
      ) : null}
      {record.status === 'received_at_hub' ? (
        <Link
          className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
          to="/sorting"
        >
          Open Sorting
        </Link>
      ) : null}
      <label
        className="mt-3 block text-sm font-medium"
        htmlFor="transition-reason"
      >
        Operational reason (optional)
        <textarea
          className={`${field} mt-1 h-20 py-2`}
          disabled={!actionsEnabled}
          id="transition-reason"
          maxLength={1000}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Add context for a manual recovery or handoff review"
          value={reason}
        />
      </label>
      <div className="mt-4 space-y-3">
        {hubTransitions.length ? (
          hubTransitions.map(transitionControl)
        ) : (
          <p className="border-l-2 border-slate-300 pl-3 text-sm text-slate-600 dark:text-slate-400 dark:border-white/20">
            No recovery action is available from this state.
          </p>
        )}
      </div>
    </section>
  )
}

function EvidenceSelector({
  disabled = false,
  label,
  evidence,
  value,
  onChange,
  empty,
}: {
  disabled?: boolean
  label: string
  evidence: FulfillmentEvidence[]
  value: string
  onChange: (value: string) => void
  empty: string
}) {
  return (
    <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-400">
      {label}
      {evidence.length ? (
        <select
          className={`${field} mt-1`}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {evidence.map((item) => (
            <option key={item.id} value={item.id}>
              {human(item.status)} · {formatDate(item.submitted_at)}
            </option>
          ))}
        </select>
      ) : (
        <span className="mt-1 block border-l-2 border-amber-500 pl-3 text-xs font-normal text-amber-700 dark:text-amber-300">
          {empty}
        </span>
      )}
    </label>
  )
}
