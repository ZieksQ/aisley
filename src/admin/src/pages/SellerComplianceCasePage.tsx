import { useCallback, useEffect, useState } from 'react'
import { FaArrowLeft, FaBan, FaCircleCheck, FaLock, FaRotateRight, FaTriangleExclamation } from 'react-icons/fa6'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ComplianceActionDialog } from '../components/compliance/ComplianceActionDialog'
import { ComplianceStatusBadge } from '../components/compliance/ComplianceStatusBadge'
import { ApiError } from '../lib/api'
import { applyComplianceAction, fetchComplianceCase, formatComplianceDate } from '../lib/sellerCompliance'
import type { ComplianceActionName, ComplianceCaseDetail } from '../types/sellerCompliance'

export function SellerComplianceCasePage() {
  const { caseId = '' } = useParams()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [complianceCase, setComplianceCase] = useState<ComplianceCaseDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [action, setAction] = useState<ComplianceActionName | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback((signal?: AbortSignal) => {
    setIsLoading(true); setError(null)
    fetchComplianceCase(caseId, signal)
      .then((response) => { setComplianceCase(response.data); document.title = `Compliance case | ${response.data.seller.name}` })
      .catch((requestError: unknown) => {
        if (signal?.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) { void logout().finally(() => navigate('/login', { replace: true })); return }
        setError({ status: requestError instanceof ApiError ? requestError.status : 0, message: requestError instanceof Error ? requestError.message : 'Unable to load this compliance case.' })
      })
      .finally(() => { if (!signal?.aborted) setIsLoading(false) })
  }, [caseId, logout, navigate])

  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort() }, [load, reloadKey])

  async function confirmAction(reason: string, idempotencyKey: string, confirmation?: string) {
    if (!complianceCase || !action) return
    setIsSubmitting(true); setActionError(null); setNotice(null)
    try {
      const response = await applyComplianceAction(complianceCase.id, action, { expected_revision: complianceCase.revision, idempotency_key: idempotencyKey, reason, ...(confirmation ? { confirmation } : {}) })
      setComplianceCase(response.data); setAction(null)
      setNotice(`${actionLabel(action)} completed. Request ID: ${response.meta.request_id}`)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409) {
        setAction(null); setNotice('The case changed or the action is no longer valid. The latest case has been loaded.'); setReloadKey((value) => value + 1)
      } else {
        setActionError(requestError instanceof ApiError ? requestError.errors.reason?.[0] ?? requestError.errors.confirmation?.[0] ?? requestError.message : requestError instanceof Error ? requestError.message : 'Unable to apply this action.')
      }
    } finally { setIsSubmitting(false) }
  }

  if (isLoading && !complianceCase) return <DetailSkeleton />
  if (error && !complianceCase) return <div className="mx-auto grid min-h-[70vh] max-w-3xl place-items-center px-5 text-center"><div><FaRotateRight className="mx-auto text-xl text-rose-500" /><h2 className="mt-3 text-xl font-semibold">Unable to load compliance case</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error.status === 404 ? 'This case does not exist.' : error.status === 403 ? 'You do not have permission to manage Seller compliance.' : error.message}</p><Link className="mt-5 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-white/10" to="/seller-compliance">Back to cases</Link></div></div>
  if (!complianceCase) return null

  const activeRestriction = complianceCase.restrictions.find((restriction) => restriction.is_active)
  const canAct = complianceCase.status === 'open' || complianceCase.status === 'confirmed'
  const hasCommittedAction = complianceCase.actions.some((item) => ['warning_issued', 'product_restricted', 'seller_suspension_referred'].includes(item.action))

  return <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
    <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white" to="/seller-compliance"><FaArrowLeft />Back to compliance cases</Link>
    <div className="mt-5 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 dark:border-white/10 lg:flex-row lg:items-start"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{complianceCase.product?.name ?? complianceCase.seller.name}</h2><ComplianceStatusBadge status={complianceCase.status} /></div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Case {complianceCase.id} · revision {complianceCase.revision}</p></div><div className="flex flex-wrap gap-2">
      {complianceCase.status === 'open' && <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-white/15" onClick={() => { setActionError(null); setAction('dismiss') }} type="button">Dismiss</button>}
      {canAct && <button className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 dark:border-amber-400/30 dark:text-amber-200" onClick={() => { setActionError(null); setAction('warn') }} type="button">Issue warning</button>}
      {canAct && complianceCase.product && !activeRestriction && <button className="inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:text-rose-200" onClick={() => { setActionError(null); setAction('restrict-product') }} type="button"><FaLock />Restrict Product</button>}
      {activeRestriction && <button className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-200" onClick={() => { setActionError(null); setAction('revoke-product-restriction') }} type="button"><FaCircleCheck />Remove restriction</button>}
      {canAct && complianceCase.seller.status === 'active' && <button className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800" onClick={() => { setActionError(null); setAction('suspend-seller') }} type="button"><FaBan />Suspend Seller</button>}
      {complianceCase.status === 'confirmed' && hasCommittedAction && <button className="rounded-lg bg-[#4C1268] px-3 py-2 text-sm font-semibold text-white" onClick={() => { setActionError(null); setAction('close') }} type="button">Close case</button>}
    </div></div>

    {notice && <div aria-live="polite" className="mt-5 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-[#4C1268] dark:border-purple-400/20 dark:bg-purple-400/10 dark:text-purple-200">{notice}</div>}
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.72fr)]">
      <section className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]"><h3 className="border-b border-slate-200 px-5 py-4 font-semibold dark:border-white/10">Review basis</h3><div className="p-5"><p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{complianceCase.reason}</p><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Detail label="Source" value={complianceCase.source.type === 'manual_admin_review' ? 'Manual Admin review' : complianceCase.source.type} /><Detail label="Opened" value={formatComplianceDate(complianceCase.created_at)} /><Detail label="Policy" value={complianceCase.policy ? `${complianceCase.policy.title} · v${complianceCase.policy.version}` : 'Documented platform rule'} /><Detail label="Opened by" value={complianceCase.created_by.email} /></dl></div></section>
      <section className="rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]"><h3 className="border-b border-slate-200 px-5 py-4 font-semibold dark:border-white/10">Seller and Product</h3><dl className="grid gap-5 p-5"><div><dt className="text-xs text-slate-500 dark:text-slate-400">Seller</dt><dd className="mt-1"><Link className="font-semibold text-[#b0005d] dark:text-pink-300" to={`/users/${complianceCase.seller.id}`}>{complianceCase.seller.name}</Link><p className="mt-1 text-xs text-slate-400">{complianceCase.seller.email} · {complianceCase.seller.status}</p></dd></div><Detail label="Shop" value={complianceCase.seller.shop_name} /><Detail label="Product" value={complianceCase.product?.name ?? 'Seller-level review'} />{complianceCase.product && <Detail label="Listing state" value={`${complianceCase.product.status}${complianceCase.product.is_restricted ? ' · compliance restricted' : ''}`} />}</dl></section>
    </div>

    {activeRestriction && <section className="mt-6 border-l-4 border-rose-500 bg-rose-50 px-5 py-4 dark:bg-rose-400/10"><div className="flex gap-3"><FaTriangleExclamation className="mt-1 shrink-0 text-rose-600" /><div><h3 className="font-semibold text-rose-800 dark:text-rose-200">Active Product restriction</h3><p className="mt-1 text-sm leading-6 text-rose-700 dark:text-rose-300">{activeRestriction.reason}</p><p className="mt-2 text-xs text-rose-600/80 dark:text-rose-300/70">Applied {formatComplianceDate(activeRestriction.imposed_at)}</p></div></div></section>}

    <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]"><h3 className="border-b border-slate-200 px-5 py-4 font-semibold dark:border-white/10">Immutable action history</h3>{complianceCase.actions.length ? <ol className="divide-y divide-slate-100 dark:divide-white/[0.07]">{complianceCase.actions.map((item) => <li className="px-5 py-4" key={item.id}><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><p className="font-semibold">{item.label}</p><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">{item.reason}</p><p className="mt-2 text-xs text-slate-400">by {item.actor.email}</p></div><time className="shrink-0 text-xs text-slate-400">{formatComplianceDate(item.occurred_at)}</time></div></li>)}</ol> : <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No decision has been recorded yet.</p>}</section>
    <ComplianceActionDialog action={action} complianceCase={complianceCase} error={actionError} isSubmitting={isSubmitting} onClose={() => { if (!isSubmitting) setAction(null) }} onConfirm={(reason, key, confirmation) => void confirmAction(reason, key, confirmation)} />
  </div>
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) { return <div><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 text-sm font-medium">{value || 'Not provided'}</dd></div> }
function DetailSkeleton() { return <div aria-label="Loading compliance case" className="mx-auto max-w-6xl animate-pulse px-5 py-10 sm:px-8"><div className="h-4 w-40 rounded bg-slate-200 dark:bg-white/10" /><div className="mt-6 h-9 w-72 rounded bg-slate-200 dark:bg-white/10" /><div className="mt-8 grid gap-6 lg:grid-cols-2"><div className="h-64 rounded-lg bg-white dark:bg-white/5" /><div className="h-64 rounded-lg bg-white dark:bg-white/5" /></div></div> }

function actionLabel(action: ComplianceActionName) {
  return action === 'dismiss' ? 'Case dismissal' : action === 'warn' ? 'Warning' : action === 'restrict-product' ? 'Product restriction' : action === 'revoke-product-restriction' ? 'Restriction removal' : action === 'suspend-seller' ? 'Seller suspension' : 'Case closure'
}
