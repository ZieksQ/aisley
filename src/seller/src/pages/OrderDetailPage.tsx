import { useEffect, useRef, useState, type RefObject } from 'react'
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
  const approvalDialog = useRef<HTMLDialogElement>(null)
  const rejectionDialog = useRef<HTMLDialogElement>(null)
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

      approvalDialog.current?.close()
      rejectionDialog.current?.close()
      navigate('/orders/approval', {
        replace: true,
        state: {
          decision: decision === 'approve' ? 'approved' : 'rejected',
          reference: order.reference,
        },
      })
    } catch (reason) {
      if (!alive.current || accessError(reason)) return
      approvalDialog.current?.close()
      rejectionDialog.current?.close()

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
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          className={`${orderLink} inline-flex min-h-11 items-center text-sm`}
          to={preparation ? `/orders/${orderId}` : backTo}
        >
          ← {preparation ? 'Back to order' : backLabel}
        </Link>
        <OrderButton disabled={deciding} isLoading={loading} loadingLabel="Refreshing" onClick={refresh}>
          Refresh
        </OrderButton>
      </div>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4C1268] dark:text-purple-300">
            {preparation ? 'Order preparation' : 'Order workspace'}
          </p>
          <h1 className="mt-1 break-all text-2xl font-semibold tracking-tight sm:text-3xl">
            {order ? order.reference : preparation ? 'Prepare order' : 'Order details'}
          </h1>
          {order && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Placed <time dateTime={order.placed_at}>{orderDate(order.placed_at)}</time>
            </p>
          )}
        </div>

        {order && !preparation && (
          <div className="flex flex-wrap gap-2">
            {order.capabilities.can_prepare && (
              <Link
                className="inline-flex min-h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:border-white/20 dark:hover:bg-white/5"
                to="/orders/pickup"
              >
                Open pickup preparation
              </Link>
            )}
            {order.capabilities.can_approve && (
              <>
                <OrderButton
                  className="border-red-300! text-red-800! hover:bg-red-50! focus-visible:ring-red-600/20 dark:border-red-400/40! dark:text-red-200! dark:hover:bg-red-400/10!"
                  disabled={deciding}
                  onClick={() => rejectionDialog.current?.showModal()}
                >
                  Reject
                </OrderButton>
                <OrderButton
                  variant="secondary"
                  disabled={loading || !!error}
                  isLoading={deciding}
                  loadingLabel="Saving decision"
                  onClick={() => approvalDialog.current?.showModal()}
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

      <ApprovalDialog
        deciding={deciding}
        dialogRef={approvalDialog}
        orderReference={order?.reference}
        onCancel={() => approvalDialog.current?.close()}
        onConfirm={() => void decide('approve')}
      />
      <RejectionDialog
        deciding={deciding}
        dialogRef={rejectionDialog}
        onCancel={() => rejectionDialog.current?.close()}
        onConfirm={() => void decide('reject')}
      />
    </main>
  )
}

function ApprovalDialog({
  deciding,
  dialogRef,
  orderReference,
  onCancel,
  onConfirm,
}: {
  deciding: boolean
  dialogRef: RefObject<HTMLDialogElement | null>
  orderReference?: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="approve-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-zinc-950 shadow-xl backdrop:bg-black/50 dark:border-white/20 dark:bg-[#18181b] dark:text-white"
      onCancel={(event) => { if (deciding) event.preventDefault() }}
    >
      <h2 className="text-lg font-semibold" id="approve-title">Approve this order?</h2>
      <p className="mt-3 text-sm leading-6">
        You will take responsibility for preparing {orderReference}. The customer’s normal cancellation window will close.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <OrderButton disabled={deciding} onClick={onCancel}>Cancel</OrderButton>
        <OrderButton variant="secondary" isLoading={deciding} loadingLabel="Approving" onClick={onConfirm}>
          Confirm approval
        </OrderButton>
      </div>
    </dialog>
  )
}

function RejectionDialog({
  deciding,
  dialogRef,
  onCancel,
  onConfirm,
}: {
  deciding: boolean
  dialogRef: RefObject<HTMLDialogElement | null>
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="reject-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-zinc-950 shadow-xl backdrop:bg-black/50 dark:border-white/20 dark:bg-[#18181b] dark:text-white"
      onCancel={(event) => { if (deciding) event.preventDefault() }}
    >
      <h2 className="text-lg font-semibold" id="reject-title">Reject this order?</h2>
      <p className="mt-3 text-sm leading-6">
        The order will move to Rejected and its reserved inventory will be released. This decision cannot be reversed here.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <OrderButton disabled={deciding} onClick={onCancel}>Cancel</OrderButton>
        <OrderButton
          className="border-red-300! text-red-800! hover:bg-red-50! focus-visible:ring-red-600/20 dark:border-red-400/40! dark:text-red-200! dark:hover:bg-red-400/10!"
          isLoading={deciding}
          loadingLabel="Rejecting"
          onClick={onConfirm}
        >
          Confirm rejection
        </OrderButton>
      </div>
    </dialog>
  )
}
