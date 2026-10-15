import '@aisley/voucher-ui/styles.css'
import { ConfirmationDialog } from '@aisley/ui/portal'
import { useEffect, useState } from 'react'
import {
  NewVoucher,
  VoucherDetail,
  VoucherList,
  type VoucherProps,
} from '@aisley/voucher-ui'
import {
  useLocation,
  useNavigate,
  useParams,
  useBlocker,
} from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { apiRequest, initializeCsrf } from '../lib/api'
import '../features/vouchers/vouchers.css'

const request: VoucherProps['request'] = async (path, options = {}) => {
  if (options.method && options.method !== 'GET')
    await initializeCsrf(options.signal ?? undefined)
  return apiRequest(path, options)
}

export function VouchersPage() {
  const { seller } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { voucherId } = useParams()
  const [guard, setGuard] = useState({
    dirty: false,
    busy: false,
    uncertain: false,
  })
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (guard.dirty || guard.busy || guard.uncertain) &&
      currentLocation.pathname !== nextLocation.pathname &&
      !nextLocation.state?.voucherCommitted,
  )
  useEffect(() => {
    document.title = 'Vouchers | Aisley Seller'
  }, [])

  const props: VoucherProps = {
    role: 'seller',
    prefix: '/api/v1/seller/vouchers',
    request,
    canManage: true,
    navigate: (path, committed) =>
      navigate(path, {
        state: committed ? { voucherCommitted: true } : undefined,
      }),
    onGuardChange: setGuard,
  }
  const accountKey = seller?.id ?? 'signed-out'
  const workspace =
    location.pathname === '/vouchers/new' ? (
      <NewVoucher key={accountKey} {...props} />
    ) : voucherId ? (
      <VoucherDetail
        key={`${accountKey}:${voucherId}`}
        {...props}
        id={voucherId}
      />
    ) : (
      <VoucherList key={accountKey} {...props} />
    )
  return (
    <div className="seller-voucher-workspace">
      {workspace}
      {blocker.state === 'blocked' && (
        <ConfirmationDialog
          title={
            guard.busy || guard.uncertain
              ? 'Finish the voucher update'
              : 'Discard unsaved voucher input?'
          }
          confirmLabel={
            guard.busy || guard.uncertain ? 'Stay on page' : 'Discard input'
          }
          onClose={() => blocker.reset()}
          onConfirm={() =>
            guard.busy || guard.uncertain ? blocker.reset() : blocker.proceed()
          }
        >
          <p>
            {guard.busy || guard.uncertain
              ? 'Resolve the pending voucher request before leaving this page.'
              : 'Your unsaved voucher terms will be discarded.'}
          </p>
        </ConfirmationDialog>
      )}
    </div>
  )
}
