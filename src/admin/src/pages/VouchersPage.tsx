import '@aisley/voucher-ui/styles.css'
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

const request: VoucherProps['request'] = async (path, options = {}) => {
  if (options.method && options.method !== 'GET')
    await initializeCsrf(options.signal ?? undefined)
  return apiRequest(path, options)
}

export function VouchersPage() {
  const { admin } = useAuth()
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
    if (blocker.state !== 'blocked') return
    if (
      !guard.busy &&
      !guard.uncertain &&
      window.confirm('Discard unsaved voucher input?')
    )
      blocker.proceed()
    else blocker.reset()
  }, [blocker, guard.busy, guard.uncertain])
  if (!admin?.permissions.includes('vouchers.view'))
    return (
      <div className="p-6" role="alert">
        Voucher viewing permission is required.
      </div>
    )
  const props: VoucherProps = {
    role: 'admin',
    prefix: '/api/v1/admin/vouchers',
    request,
    canManage: admin?.permissions.includes('vouchers.manage') ?? false,
    navigate: (path, committed) =>
      navigate(path, {
        state: committed ? { voucherCommitted: true } : undefined,
      }),
    onGuardChange: setGuard,
  }
  const accountKey = admin?.id ?? 'signed-out'
  return location.pathname === '/vouchers/new' ? (
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
}
