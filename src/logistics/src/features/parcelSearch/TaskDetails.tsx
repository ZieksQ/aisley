import { Link } from 'react-router-dom'
import type { FulfillmentTask } from '../../types/fulfillment'
import { formatDate, human, StateLabel } from './presentation'

export function TaskSummary({ task }: { task: FulfillmentTask }) {
  const active =
    task.courier_id &&
    (task.leg === 'first_mile'
      ? ['seller_pickup_assigned', 'seller_pickup_accepted'].includes(
          task.status,
        )
      : [
          'delivery_assigned',
          'delivery_accepted',
          'picked_up_from_hub',
          'in_transit',
          'out_for_delivery',
        ].includes(task.status))
  return (
    <article className="border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">
            {human(task.leg)}
          </p>
          <p className="mt-1 text-sm font-medium">
            Task {task.task_id.slice(0, 8)} · revision {task.revision}
          </p>
        </div>
        <StateLabel value={task.status} />
      </div>
      <dl className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-3">
        <div>
          <dt>Courier</dt>
          <dd className="mt-1 text-slate-800 dark:text-slate-200">
            {task.courier?.name ?? task.courier_id ?? 'Not assigned'}
          </dd>
        </div>
        <div>
          <dt>Accepted</dt>
          <dd className="mt-1">{formatDate(task.accepted_at)}</dd>
        </div>
        <div>
          <dt>Picked up</dt>
          <dd className="mt-1">{formatDate(task.picked_up_at)}</dd>
        </div>
      </dl>
      {active ? (
        <Link
          className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
          to={`/messages?leg=${task.leg}&task_id=${task.task_id}`}
        >
          Message Courier
        </Link>
      ) : null}
      {task.leg === 'final_mile' && task.failed_attempt_count ? (
        <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">
          {task.failed_attempt_count} failed delivery attempt
          {task.failed_attempt_count === 1 ? '' : 's'} · latest{' '}
          {human(task.failed_attempts?.[0]?.reason ?? 'unknown')}{' '}
          {formatDate(task.failed_attempts?.[0]?.attempted_at ?? null)}. Courier
          may retry.
        </p>
      ) : null}
    </article>
  )
}

export function EvidenceHistory({ task }: { task: FulfillmentTask }) {
  const evidence = task.evidence ?? []
  if (!evidence.length)
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        No Courier evidence has been submitted.
      </p>
    )
  return (
    <div className="border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700">
        Courier submissions
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {evidence.map((item) => (
          <li
            className="flex flex-wrap items-start justify-between gap-3 px-3 py-3"
            key={item.id}
          >
            <div>
              <p className="text-sm font-medium capitalize">
                {human(item.purpose)} · {item.type}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {item.safe_reference ?? 'Opaque reference'} · submitted{' '}
                {formatDate(item.submitted_at)}
              </p>
              {item.rejection_reason ? (
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  Reason: {item.rejection_reason}
                </p>
              ) : null}
            </div>
            <StateLabel value={item.status} />
          </li>
        ))}
      </ul>
      {evidence.some(
        (item) =>
          item.status === 'awaiting_validation' || item.status === 'submitted',
      ) ? (
        <p className="border-t border-slate-200 px-3 py-3 text-xs text-amber-800 dark:border-slate-700 dark:text-amber-300">
          Courier submission is awaiting Logistics validation. Custody remains{' '}
          {human(task.status)}.
        </p>
      ) : null}
    </div>
  )
}

export function CompletionHistory({ task }: { task: FulfillmentTask }) {
  const intents = task.completion_intents ?? []
  if (!intents.length)
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        No Courier completion intent has been submitted.
      </p>
    )
  return (
    <div className="border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700">
        Completion intents
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {intents.map((intent) => (
          <li
            className="flex flex-wrap items-start justify-between gap-3 px-3 py-3"
            key={intent.id}
          >
            <div>
              <p className="text-sm font-medium">
                Proof {intent.evidence_id.slice(0, 8)}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Confirmed {formatDate(intent.confirmed_at)} · expected revision{' '}
                {intent.expected_revision}
              </p>
            </div>
            <StateLabel value={intent.status} />
          </li>
        ))}
      </ul>
      {intents.some((intent) => intent.status === 'awaiting_validation') ? (
        <p className="border-t border-slate-200 px-3 py-3 text-xs text-amber-800 dark:border-slate-700 dark:text-amber-300">
          Completion intent is waiting for Logistics to validate the proof. It
          does not mark the Order delivered.
        </p>
      ) : null}
    </div>
  )
}
