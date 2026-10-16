import { ConfirmationDialog } from '@aisley/ui/portal'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { OrderDetailContent, OrderDetailLoading } from '../components/orders/OrderDetailContent'
import { OrderButton, OrderError, orderLink } from '../components/orders/OrderUi'
import { ApiError } from '../lib/api'
import {
  createOrderApproval,
  createOrderRejection,
  markOrderNotificationRead,
} from '../lib/sellerOrderActions'
import { useOrderAccessError, useSellerOrders } from '../lib/useSellerOrders'
import { orderDate, type SellerOrder } from '../types/orders'

export function OrderDetailPage({ preparation = false }: { preparation?: boolean }) {
  const { orderId = '' } = useParams()
  return <OrderDetail key={`${orderId}-${preparation}`} orderId={orderId} preparation={preparation} />
}

function OrderDetail({ orderId, preparation }: { orderId: string; preparation: boolean }) {
  const { seller } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const accessError = useOrderAccessError()
  const { data, loading, error, refresh } = useSellerOrders<{ data: SellerOrder }>(
    `/api/v1/seller/orders/${encodeURIComponent(orderId)}`,
  )
  const order = data?.data
  const [actionError, setActionError] = useState('')
  const [readError, setReadError] = useState('')
  const [readId, setReadId] = useState('')
  const [readRetry, setReadRetry] = useState(0)
  const [deciding, setDeciding] = useState(false)
  const submitting = useRef(false)
  const approval = useRef<ReturnType<typeof createOrderApproval> | null>(null)
  const rejection = useRef<ReturnType<typeof createOrderRejection> | null>(null)
  const [decisionDialog, setDecisionDialog] = useState<'approve' | 'reject' | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  useEffect(() => {
    document.title = `${preparation ? 'Prepare order' : 'Order'}${order ? ` ${order.reference}` : ''} | Aisley Seller`
  }, [order, preparation])

  const notificationId = order?.notification?.id
  const notificationReadAt = order?.notification?.read_at
  useEffect(() => {
    if (!notificationId || notificationReadAt || readId === notificationId) return
    const controller = new AbortController()

    async function markRead() {
      try {
        await markOrderNotificationRead(notificationId!, controller.signal)
        if (!controller.signal.aborted) {
          setReadId(notificationId!)
          setReadError('')
        }
      } catch (reason) {
        if (!controller.signal.aborted && !accessError(reason)) {
          setReadError('The order is open, but its notification could not be marked as read.')
        }
      }
    }

    void markRead()
    return () => controller.abort()
  }, [notificationId, notificationReadAt, readId, readRetry, accessError])

  async function decide(decision: 'approve' | 'reject') {
    if (submitting.current || !order?.capabilities.can_approve || error || loading) return
    submitting.current = true
    setDeciding(true)
    setActionError('')

    try {
      if (decision === 'approve') approval.current ??= createOrderApproval(seller!.id, orderId)
      else rejection.current ??= createOrderRejection(seller!.id, orderId)

      await (decision === 'approve' ? approval.current!() : rejection.current!())
      if (!alive.current) return

      setDecisionDialog(null)
      navigate('/orders/approval', {
        replace: true,
        state: {
          decision: decision === 'approve' ? 'approved' : 'rejected',
          reference: order.reference,
        },
      })
    } catch (reason) {
      if (!alive.current || accessError(reason)) return
      setDecisionDialog(null)

      if (reason instanceof ApiError && reason.status === 409) {
        setActionError(`${reason.message} The order is being refreshed; review its current status before trying again.`)
        refresh()
      } else {
        setActionError(reason instanceof ApiError
          ? reason.message
          : 'The order decision could not be confirmed. Refresh to check its current status before retrying.')
      }
    } finally {
      submitting.current = false
      if (alive.current) setDeciding(false)
    }
  }

  const backTo = typeof location.state?.backTo === 'string'
    && location.state.backTo.startsWith('/orders')
    ? location.state.backTo
    : '/orders/monitoring'
  const backLabel = backTo.includes('/approval')
    ? 'Back to approval queue'
    : backTo.includes('/pickup/')
      ? 'Back to pickup parcels'
      : 'Back to monitoring'

  return (
    <main className="portal-page seller-order-workspace">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          className={`${orderLink} inline-flex min-h-11 items-center text-sm`}
          to={preparation ? '/orders/pickup' : backTo}
        >
          ← {preparation ? 'Back to pickup preparation' : backLabel}
        </Link>
        <OrderButton disabled={deciding} isLoading={loading} loadingLabel="Refreshing" onClick={refresh}>
          Refresh
        </OrderButton>
      </div>

      <header className="portal-page-header mt-4">
        <div>
          <h1 className="portal-page-heading break-all">
            {order ? order.reference : preparation ? 'Prepare order' : 'Order details'}
          </h1>
          {order && (
            <p className="mt-2 text-sm text-[var(--portal-muted)]">
              Placed <time dateTime={order.placed_at}>{orderDate(order.placed_at)}</time>
            </p>
          )}
        </div>

        {order && !preparation && (
          <div className="flex flex-wrap gap-2">
            {order.capabilities.can_prepare && (
              <Link
                className="portal-button"
                to="/orders/pickup"
              >
                Open pickup preparation
              </Link>
            )}
            {order.capabilities.can_approve && (
              <>
                <OrderButton
                  className="portal-icon-danger"
                  disabled={deciding}
                  onClick={() => setDecisionDialog('reject')}
                >
                  Reject
                </OrderButton>
                <OrderButton
                  variant="secondary"
                  disabled={loading || !!error}
                  isLoading={deciding}
                  loadingLabel="Saving decision"
                  onClick={() => setDecisionDialog('approve')}
                >
                  Approve order
                </OrderButton>
              </>
            )}
          </div>
        )}
      </header>

      {error && <OrderError message={error} retry={refresh} />}
      {readError && (
        <OrderError message={readError} retry={() => setReadRetry((value) => value + 1)} />
      )}
      {actionError && <OrderError message={actionError} retry={refresh} />}

      {!order && loading ? (
        <OrderDetailLoading />
      ) : order ? (
        <OrderDetailContent order={order} preparation={preparation} />
      ) : null}

      {decisionDialog && (
        <ConfirmationDialog
          title={decisionDialog === 'approve' ? 'Approve this order?' : 'Reject this order?'}
          confirmLabel={decisionDialog === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
          destructive={decisionDialog === 'reject'}
          busy={deciding}
          confirmDisabled={loading || Boolean(error)}
          onClose={() => setDecisionDialog(null)}
          onConfirm={() => void decide(decisionDialog)}
        >
          {decisionDialog === 'approve'
            ? `You will prepare ${order?.reference}. The customer’s normal cancellation window will close.`
            : 'The order will move to Rejected and its reserved inventory will be released. This decision cannot be reversed here.'}
        </ConfirmationDialog>
      )}
    </main>
  )
}
