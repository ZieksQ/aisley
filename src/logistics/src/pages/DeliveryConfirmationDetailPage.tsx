import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { LuArrowLeft } from 'react-icons/lu'
import { PortalButton, PortalSkeleton, PortalState } from '@aisley/ui/portal'
import { ErrorNotice } from '../components/PickupUi'
import { ReviewWorkspace } from '../features/deliveryReview/ReviewWorkspace'
import { useDeliveryReview } from '../features/deliveryReview/useDeliveryReview'
import '../features/transport.css'

export function DeliveryConfirmationDetailPage() {
  const { proofId = '' } = useParams()
  const [params] = useSearchParams()
  const view = params.get('view') === 'history' ? 'history' : 'pending'
  const reference = params.get('reference') ?? ''
  const state = useDeliveryReview(view, reference, 1, proofId)
  const backParams = new URLSearchParams(params.get('return') ?? '')
  backParams.set('view', view)
  const back = `/delivery-confirmations?${backParams}`
  useEffect(() => {
    document.title = `${reference || 'Delivery review'} | Aisley Logistics`
  }, [reference])
  return (
    <div className="transport-workspace">
      {state.locked ? (
        <p className="portal-secondary mb-3 text-sm">
          Resolve the current decision before leaving this review.
        </p>
      ) : (
        <Link to={back} className="transport-back">
          <LuArrowLeft aria-hidden="true" />
          Back to {view === 'history' ? 'history' : 'pending reviews'}
        </Link>
      )}
      <header className="transport-heading">
        <div>
          <h1>Delivery details</h1>
          <p>
            {reference ||
              'Review the selected delivery proof and its Order context.'}
          </p>
        </div>
        <PortalButton
          disabled={state.busy || state.loading}
          onClick={() => void state.load()}
        >
          Refresh
        </PortalButton>
      </header>
      {state.error && (
        <ErrorNotice message={state.error} retry={() => void state.load()} />
      )}
      {state.notice && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        >
          {state.notice}
        </p>
      )}
      {state.attempt && (
        <div
          role="status"
          className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500 p-4 text-sm"
        >
          <p>
            {state.busy
              ? 'Submitting decision…'
              : 'The result is uncertain. Refresh to check or retry the same action.'}
          </p>
          {!state.busy && (
            <PortalButton onClick={() => void state.run(state.attempt!)}>
              Retry same action
            </PortalButton>
          )}
        </div>
      )}
      {state.loading ? (
        <PortalSkeleton label="Loading delivery details" />
      ) : state.selected ? (
        <ReviewWorkspace
          key={state.selected.proof.id}
          state={state}
          history={state.selected.proof.status !== 'awaiting_validation'}
        />
      ) : (
        !state.error && (
          <PortalState
            title="This review is no longer in this view"
            description="It may have been reviewed or become unavailable. Return to the list for the latest delivery confirmations."
            action={
              <Link className="portal-button" to={back}>
                Return to list
              </Link>
            }
          />
        )
      )}
    </div>
  )
}
