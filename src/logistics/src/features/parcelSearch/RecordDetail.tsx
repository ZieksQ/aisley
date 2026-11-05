import { Link } from 'react-router-dom'
import { FaTruckFast } from 'react-icons/fa6'
import type {
  FulfillmentShipment,
  FulfillmentTask,
} from '../../types/fulfillment'
import { formatDate, StateLabel } from './presentation'
import { CustodyControls } from './CustodyControls'
import { TaskSummary, EvidenceHistory, CompletionHistory } from './TaskDetails'

export type RecordDetailProps = {
  actionsEnabled: boolean
  record: FulfillmentShipment
  reason: string
  setReason: (value: string) => void
  evidenceChoice: Record<string, string>
  setEvidenceChoice: (value: Record<string, string>) => void
  transitionBusy: boolean
  onTransition: (target: string, evidenceId?: string) => void
  onProofRejected: () => void
  finalTask: FulfillmentTask | null
}

export function RecordDetail(props: RecordDetailProps) {
  const { record, finalTask } = props
  return (
    <div className="parcel-record p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="break-words font-mono text-xs text-slate-600 dark:text-slate-400">
            Shipment {record.shipment_id}
          </p>
          <h4 className="mt-1 text-lg font-semibold">
            {record.parcel?.order_reference ??
              record.parcel?.reference ??
              'Fulfillment record'}
          </h4>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Tracking ID{' '}
            {record.parcel?.tracking_id ??
              record.parcel?.waybill_reference ??
              'unavailable'}{' '}
            · {record.parcel?.item_count ?? 0} item
            {record.parcel?.item_count === 1 ? '' : 's'}
          </p>
        </div>
        <StateLabel value={record.status} />
      </div>
      {record.parcel?.order_id &&
      !['delivered', 'in_transfer'].includes(record.status) ? (
        <Link
          className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
          to={`/messages?order_id=${record.parcel.order_id}`}
        >
          Message Customer
        </Link>
      ) : null}
      <dl className="mt-5 grid gap-3 border-y border-slate-200 py-4 text-sm dark:border-slate-700 sm:grid-cols-3">
        <div>
          <dt className="text-slate-600 dark:text-slate-400">Revision</dt>
          <dd className="mt-1 font-mono">{record.revision}</dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd className="mt-1">{formatDate(record.last_activity_at)}</dd>
        </div>
        <div>
          <dt className="text-slate-600 dark:text-slate-400">
            Allowed next states
          </dt>
          <dd className="mt-1">
            {record.allowed_transitions.length || 'None'}
          </dd>
        </div>
      </dl>

      <CustodyControls {...props} />
      <section className="mt-7 border-t border-slate-200 pt-5 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <FaTruckFast
            className="text-blue-700 dark:text-blue-300"
            aria-hidden="true"
          />
          <h5 className="font-semibold">Task assignments</h5>
        </div>
        <div className="mt-3 space-y-4">
          {record.tasks.map((task) => (
            <TaskSummary key={task.task_id} task={task} />
          ))}
        </div>
      </section>

      <section className="mt-7 border-t border-slate-200 pt-5 dark:border-slate-700">
        <h5 className="font-semibold">Evidence and completion review</h5>
        <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">
          Evidence is shown as a separate lifecycle. A pending Courier
          submission never changes custody on its own.
        </p>
        {finalTask ? (
          <div className="mt-3 space-y-3">
            <EvidenceHistory task={finalTask} />
            <CompletionHistory task={finalTask} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            No final-mile task exists until hub dispatch is committed.
          </p>
        )}
      </section>
    </div>
  )
}
