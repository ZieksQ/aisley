import { useCallback, useEffect, useState } from 'react'
import { FaArrowLeft, FaBan, FaClockRotateLeft, FaPause, FaRotateRight, FaUserCheck } from 'react-icons/fa6'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { LifecycleActionDialog } from '../components/users/LifecycleActionDialog'
import { UserStatusBadge } from '../components/users/UserStatusBadge'
import { ApiError } from '../lib/api'
import { changeManagedUserStatus, fetchManagedUser, fetchManagedUserHistory, formatUserDate, roleLabel, statusLabel } from '../lib/users'
import type { AccountLifecycleHistoryResponse, ManagedUserDetail } from '../types/users'

type Action = 'suspend' | 'restore' | 'deactivate'

export function UserDetailPage() {
  const { userId = '' } = useParams()
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const [user, setUser] = useState<ManagedUserDetail | null>(null)
  const [history, setHistory] = useState<AccountLifecycleHistoryResponse | null>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [action, setAction] = useState<Action | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const canManage = admin?.permissions.includes('users.manage') ?? false

  const load = useCallback((signal?: AbortSignal) => {
    setIsLoading(true)
    setError(null)
    Promise.all([
      fetchManagedUser(userId, signal),
      fetchManagedUserHistory(userId, historyPage, signal),
    ])
      .then(([detail, lifecycleHistory]) => {
        setUser(detail.data)
        setHistory(lifecycleHistory)
        document.title = `${detail.data.display_name} | Aisley Admin`
      })
      .catch((requestError: unknown) => {
        if (signal?.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true }))
          return
        }
        setError({
          status: requestError instanceof ApiError ? requestError.status : 0,
          message: requestError instanceof Error ? requestError.message : 'Unable to load this user account.',
        })
      })
      .finally(() => {
        if (!signal?.aborted) setIsLoading(false)
      })
  }, [historyPage, logout, navigate, userId])

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load, reloadKey])

  async function confirmAction(reason: string | null) {
    if (!user || !action) return
    setIsSubmitting(true)
    setActionError(null)
    setNotice(null)
    try {
      const response = await changeManagedUserStatus(user.id, action, user.status, reason)
      setUser(response.data)
      setAction(null)
      setHistoryPage(1)
      setNotice(`Account ${action === 'suspend' ? 'suspended' : action === 'restore' ? 'restored' : 'deactivated'} successfully.`)
      setReloadKey((value) => value + 1)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409) {
        setAction(null)
        setNotice('The account changed while you were reviewing it. The latest status has been loaded.')
        setReloadKey((value) => value + 1)
      } else {
        setActionError(requestError instanceof ApiError && requestError.errors.reason?.[0]
          ? requestError.errors.reason[0]
          : requestError instanceof Error ? requestError.message : 'Unable to update this account.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading && !user) return <DetailSkeleton />

  if (error && !user) {
    return <div className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-5 text-center"><div><FaRotateRight aria-hidden="true" className="mx-auto text-xl text-rose-500" /><h2 className="mt-3 text-xl font-semibold">Unable to load account</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error.status === 404 ? 'This account does not exist or cannot be managed here.' : error.status === 403 ? 'Your administrator account does not have permission to view this account.' : error.message}</p><div className="mt-5 flex justify-center gap-3"><Link className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10" to="/users">Back to users</Link><button className="rounded-lg bg-[#4C1268] px-4 py-2 text-sm font-semibold text-white" onClick={() => setReloadKey((value) => value + 1)} type="button">Try again</button></div></div></div>
  }

  if (!user) return null

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" to="/users"><FaArrowLeft aria-hidden="true" />Back to user accounts</Link>

      <div className="mt-5 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-white/10 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{user.display_name}</h2><UserStatusBadge status={user.status} /></div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{user.email} · {roleLabel(user.role)} · ID {user.id}</p>
        </div>
        {canManage && <div className="flex flex-wrap gap-2">
          {user.status === 'active' && <button className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-400/30 dark:text-amber-200 dark:hover:bg-amber-400/10" onClick={() => { setActionError(null); setAction('suspend') }} type="button"><FaPause aria-hidden="true" />Suspend</button>}
          {user.status === 'suspended' && <button className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-400/30 dark:text-emerald-200 dark:hover:bg-emerald-400/10" onClick={() => { setActionError(null); setAction('restore') }} type="button"><FaUserCheck aria-hidden="true" />Restore</button>}
          {(user.status === 'active' || user.status === 'suspended') && <button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10" onClick={() => { setActionError(null); setAction('deactivate') }} type="button"><FaBan aria-hidden="true" />Deactivate</button>}
        </div>}
      </div>

      {notice && <div aria-live="polite" className="mt-5 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-[#4C1268] dark:border-purple-400/20 dark:bg-purple-400/10 dark:text-purple-200">{notice}</div>}
      {error && <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">{error.message}</div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <section className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
          <h3 className="border-b border-slate-200 px-5 py-4 font-semibold dark:border-white/10">Account information</h3>
          <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
            <Detail label="First name" value={user.profile.first_name} />
            <Detail label="Middle name" value={user.profile.middle_name} />
            <Detail label="Last name" value={user.profile.last_name} />
            <Detail label="Contact" value={user.profile.contact_number} />
            <Detail label="Role" value={roleLabel(user.role)} />
            <Detail label="Current status" value={statusLabel(user.status)} />
            <Detail label="Joined" value={formatUserDate(user.created_at)} />
            <Detail label="Last lifecycle change" value={formatUserDate(user.status_changed_at)} />
          </dl>
          {user.role_summary && <div className="border-t border-slate-200 px-5 py-4 text-sm dark:border-white/10">
            {user.role === 'seller' ? <p><span className="text-slate-500 dark:text-slate-400">Shop:</span> <strong>{user.role_summary.shop_name ?? 'No shop'}</strong>{user.role_summary.shop_status ? ` · ${user.role_summary.shop_status}` : ''}</p> : <p><span className="text-slate-500 dark:text-slate-400">Registered vehicles:</span> <strong>{user.role_summary.vehicle_count ?? 0}</strong></p>}
          </div>}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
          <h3 className="border-b border-slate-200 px-5 py-4 font-semibold dark:border-white/10">Registration summary</h3>
          {user.registration ? <dl className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><Detail label="Application status" value={user.registration.status} /><Detail label="Submitted" value={formatUserDate(user.registration.submitted_at)} /><Detail label="Reviewed" value={formatUserDate(user.registration.reviewed_at)} /><div><dt className="text-xs text-slate-500 dark:text-slate-400">Application</dt><dd className="mt-1">{user.role === 'courier' ? <span className="text-sm text-slate-500 dark:text-slate-400">Managed by its Logistics approval workflow</span> : <Link className="font-semibold text-[#b0005d] dark:text-pink-300" to={`/registrations/${user.registration.id}`}>Open registration</Link>}</dd></div></dl> : <p className="p-5 text-sm text-slate-500 dark:text-slate-400">No registration application is linked to this account.</p>}
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-white/10"><FaClockRotateLeft aria-hidden="true" className="text-[#E6007A]" /><h3 className="font-semibold">Lifecycle history</h3></div>
        {history?.data.length ? <ol className="divide-y divide-slate-100 dark:divide-white/[0.07]">{history.data.map((event) => <li className="px-5 py-4" key={event.id}><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><p className="font-semibold">{event.action_label}</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{statusLabel(event.previous_status)} → {statusLabel(event.new_status)} · by {event.actor.name}</p>{event.reason && <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{event.reason}</p>}</div><time className="shrink-0 text-xs text-slate-400">{formatUserDate(event.occurred_at)}</time></div></li>)}</ol> : <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No lifecycle actions have been recorded.</p>}
        {history && history.meta.last_page > 1 && <nav aria-label="Lifecycle history pages" className="flex items-center justify-between border-t border-slate-200 px-5 py-4 dark:border-white/10"><p className="text-sm text-slate-500">Page {history.meta.current_page} of {history.meta.last_page}</p><div className="flex gap-2"><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-white/10" disabled={historyPage <= 1} onClick={() => setHistoryPage((value) => value - 1)} type="button">Previous</button><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40 dark:border-white/10" disabled={historyPage >= history.meta.last_page} onClick={() => setHistoryPage((value) => value + 1)} type="button">Next</button></div></nav>}
      </section>

      {!canManage && <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">You can view this account, but you do not have permission to change its lifecycle status.</p>}

      <LifecycleActionDialog action={action} currentStatus={user.status} error={actionError} isSubmitting={isSubmitting} onClose={() => { if (!isSubmitting) setAction(null) }} onConfirm={(reason) => void confirmAction(reason)} userName={user.display_name} />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 text-sm font-medium">{value === null || value === undefined || value === '' ? 'Not provided' : value}</dd></div>
}

function DetailSkeleton() {
  return <div aria-label="Loading user account" className="mx-auto max-w-6xl animate-pulse px-5 py-10 sm:px-8"><div className="h-4 w-36 rounded bg-slate-200 dark:bg-white/10" /><div className="mt-6 h-9 w-64 rounded bg-slate-200 dark:bg-white/10" /><div className="mt-8 grid gap-6 lg:grid-cols-2"><div className="h-72 rounded-lg bg-white dark:bg-white/5" /><div className="h-72 rounded-lg bg-white dark:bg-white/5" /></div></div>
}
