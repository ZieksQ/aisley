import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { FaArrowLeft, FaArrowsRotate, FaCheck, FaFileLines, FaTriangleExclamation, FaXmark } from 'react-icons/fa6'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ActionButton, ErrorNotice, PrimaryButton, field, link, manilaDate, panel } from '../components/PickupUi'
import { ApiError, blob, csrf, requestWithTimeout } from '../lib/api'
import type { CourierApplicationDetail, CourierApplicationDetailResponse, CourierApplicationDocument } from '../types/courierApplications'

type Decision = 'approve' | 'reject'
type EvidenceState = { status: 'idle' | 'loading' | 'success' | 'forbidden' | 'missing' | 'unavailable'; url?: string; error?: string }

function statusLabel(status: string | null | undefined): string {
  return (status ?? 'unknown').replaceAll('_', ' ')
}

function statusClass(status: string | null | undefined): string {
  if (status === 'approved' || status === 'verified' || status === 'active') return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300'
  if (status === 'rejected' || status === 'deactivated' || status === 'suspended') return 'bg-red-50 text-red-800 dark:bg-red-400/10 dark:text-red-300'
  return 'bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300'
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  return <span className={`inline-block rounded-md px-2 py-1 text-xs font-medium capitalize ${statusClass(status)}`}>{statusLabel(status)}</span>
}

function displayName(detail: CourierApplicationDetail): string {
  const profile = detail.courier.profile
  return [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') || detail.courier.email || 'Courier applicant'
}

function documentSize(bytes: number | null): string {
  if (!bytes) return 'Size unavailable'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function evidenceMessage(state: EvidenceState): string {
  if (state.status === 'forbidden') return 'Evidence is not available to this Logistics account.'
  if (state.status === 'missing') return 'The applicant did not provide this document.'
  if (state.status === 'unavailable') return 'Evidence could not be reached right now. Try again later.'
  return state.error ?? 'Evidence is unavailable.'
}

function EvidenceCard({ document, state, onPreview }: { document: CourierApplicationDocument; state: EvidenceState; onPreview: () => void }) {
  const isImage = document.mime_type?.startsWith('image/') ?? false
  return <li className="border-t border-zinc-200 py-4 first:border-t-0 first:pt-0 last:pb-0 dark:border-white/10">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 grid size-9 shrink-0 place-items-center bg-zinc-100 text-zinc-500 dark:bg-white/10 dark:text-zinc-300"><FaFileLines aria-hidden="true" /></span><div className="min-w-0"><p className="font-medium">{document.label}</p><p className="mt-1 truncate text-xs text-zinc-500">{document.original_name ?? 'Filename unavailable'} · {documentSize(document.size_bytes)}</p></div></div><StatusBadge status={document.status} />
    </div>
    {!document.present ? <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Missing evidence</p> : state.status === 'success' && state.url ? <div className="mt-3 space-y-3"><div className="overflow-hidden border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-white/[0.03]">{isImage ? <img alt={`${document.label} preview`} className="max-h-72 w-full object-contain" src={state.url} /> : <a className={`${link} block p-4 text-sm`} href={state.url} rel="noreferrer" target="_blank">Open document preview</a>}</div><div className="flex gap-3 text-sm"><a className={link} download={document.original_name ?? 'courier-document'} href={state.url}>Download</a><button className={link} onClick={onPreview} type="button">Reload preview</button></div></div> : state.status === 'loading' ? <p className="mt-3 text-sm text-zinc-500" role="status">Loading private evidence…</p> : state.status === 'forbidden' || state.status === 'unavailable' ? <div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-sm text-zinc-600 dark:text-zinc-400">{evidenceMessage(state)}</p>{state.status === 'unavailable' ? <button className={`${link} text-sm`} onClick={onPreview} type="button">Try again</button> : null}</div> : <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/10" onClick={onPreview} type="button">Preview evidence</button>}
  </li>
}

export function CourierApplicationDetailPage() {
  const { affiliationId = '' } = useParams()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const backButton = useRef<HTMLAnchorElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const evidenceUrls = useRef<Set<string>>(new Set())
  const [detail, setDetail] = useState<CourierApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const [decisionFieldError, setDecisionFieldError] = useState('')
  const [busy, setBusy] = useState(false)
  const [evidence, setEvidence] = useState<Record<string, EvidenceState>>({})

  function clearEvidenceUrls() {
    evidenceUrls.current.forEach((url) => URL.revokeObjectURL(url))
    evidenceUrls.current.clear()
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await requestWithTimeout<CourierApplicationDetailResponse>(`/api/v1/logistics/courier-applications/${affiliationId}`)
      setDetail(response.data)
      clearEvidenceUrls()
      setEvidence({})
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        await logout()
        navigate('/login', { replace: true })
        return
      }
      if (caught instanceof ApiError && caught.status === 403 && caught.code === 'POLICY_CONSENT_REQUIRED') {
        navigate('/policy-consent', { replace: true })
        return
      }
      if (caught instanceof ApiError && caught.status === 404) {
        setError('This Courier application is unavailable to your organization or no longer exists.')
      } else {
        setError(caught instanceof ApiError ? caught.message : 'Courier application details could not be loaded.')
      }
    } finally {
      setLoading(false)
    }
  }, [affiliationId, logout, navigate])

  useEffect(() => {
    document.title = 'Courier application review | Aisley Logistics'
    void load()
  }, [load])

  useEffect(() => () => {
    evidenceUrls.current.forEach((url) => URL.revokeObjectURL(url))
    evidenceUrls.current.clear()
  }, [])

  function openDecision(next: Decision, event: MouseEvent<HTMLButtonElement>) {
    if (!detail || detail.status !== 'pending' || dialog.current?.open) return
    trigger.current = event.currentTarget
    setDecision(next)
    setReason('')
    setDecisionError('')
    setDecisionFieldError('')
    dialog.current?.showModal()
  }

  function closeDecision() {
    if (busy) return
    dialog.current?.close()
  }

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!decision || !detail || busy) return
    if (decision === 'reject' && reason.trim().length < 3) {
      setDecisionFieldError('Enter a reason of at least 3 characters.')
      return
    }
    setBusy(true)
    setDecisionError('')
    setDecisionFieldError('')
    try {
      await csrf()
      const response = await requestWithTimeout<CourierApplicationDetailResponse>(`/api/v1/logistics/courier-applications/${detail.id}/${decision}`, {
        method: 'POST',
        body: JSON.stringify(decision === 'reject' ? { reason: reason.trim() } : {}),
      })
      setDetail(response.data)
      clearEvidenceUrls()
      setEvidence({})
      setNotice(decision === 'approve' ? 'Courier approved. The account is now active.' : 'Courier application rejected.')
      dialog.current?.close()
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        await logout()
        navigate('/login', { replace: true })
        return
      }
      if (caught instanceof ApiError && caught.status === 403 && caught.code === 'POLICY_CONSENT_REQUIRED') {
        dialog.current?.close()
        navigate('/policy-consent', { replace: true })
        return
      }
      if (caught instanceof ApiError && caught.status === 408) {
        await load()
        dialog.current?.close()
        setNotice('The decision request timed out. The recorded application state has been reloaded; confirm the status before trying again.')
      } else if (caught instanceof ApiError && caught.status === 409) {
        setDecisionError(caught.message || 'This application changed while you were reviewing it. Reload the recorded decision.')
        await load()
      } else if (caught instanceof ApiError && caught.status === 422) {
        setDecisionFieldError(caught.errors.reason?.[0] ?? '')
        setDecisionError(Object.keys(caught.errors).length ? 'Please correct the highlighted reason.' : caught.message)
      } else {
        setDecisionError(caught instanceof ApiError ? caught.message : 'The decision could not be saved. Refresh before trying again.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function preview(document: CourierApplicationDocument) {
    if (!document.preview_url || !document.present) {
      setEvidence((current) => ({ ...current, [document.id]: { status: 'missing' } }))
      return
    }
    const previous = evidence[document.id]
    if (previous?.url) {
      URL.revokeObjectURL(previous.url)
      evidenceUrls.current.delete(previous.url)
    }
    setEvidence((current) => ({ ...current, [document.id]: { status: 'loading' } }))
    try {
      const response = await blob(document.preview_url)
      const url = URL.createObjectURL(response)
      evidenceUrls.current.add(url)
      setEvidence((current) => ({ ...current, [document.id]: { status: 'success', url } }))
    } catch (caught) {
      const status = caught instanceof ApiError && caught.status === 403 ? 'forbidden' : caught instanceof ApiError && caught.status === 404 ? 'missing' : 'unavailable'
      setEvidence((current) => ({ ...current, [document.id]: { status } }))
    }
  }

  if (loading && !detail) return <div className="p-6 text-sm" role="status">Loading Courier application…</div>

  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <Link className={`${link} inline-flex items-center gap-2 text-sm`} ref={backButton} to="/courier-applications"><FaArrowLeft aria-hidden="true" />Back to applications</Link>
    {error ? <div className="mt-5"><ErrorNotice message={error} retry={() => void load()} /></div> : null}
    {detail ? <>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-semibold">{displayName(detail)}</h2><StatusBadge status={detail.status} /></div><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{detail.courier.email} · Submitted {manilaDate(detail.application?.submitted_at ?? detail.created_at)}</p></div><div className="flex flex-wrap gap-2">{detail.status === 'pending' ? <><ActionButton onClick={(event) => openDecision('reject', event)}><FaXmark aria-hidden="true" />Reject</ActionButton><PrimaryButton disabled={!detail.completeness.complete} onClick={(event) => openDecision('approve', event)}><FaCheck aria-hidden="true" />Approve</PrimaryButton></> : <ActionButton busy={loading} onClick={() => void load()}><FaArrowsRotate aria-hidden="true" />Refresh</ActionButton>}</div></div>
      {notice ? <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{notice}</p> : null}
      {detail.status === 'pending' && !detail.completeness.complete ? <div className="mt-4 flex gap-3 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200"><FaTriangleExclamation aria-hidden="true" className="mt-0.5 shrink-0" /><p><strong>Application incomplete.</strong> Approval is unavailable until {detail.completeness.missing.join(', ').replaceAll('_', ' ')} is provided and readable.</p></div> : null}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <section className={`${panel} p-5`}><h3 className="font-semibold">Applicant details</h3><dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2"><div><dt className="text-xs text-zinc-500">Full name</dt><dd className="mt-1 text-sm">{displayName(detail)}</dd></div><div><dt className="text-xs text-zinc-500">Contact number</dt><dd className="mt-1 text-sm">{detail.courier.profile.contact_number || 'Not provided'}</dd></div><div><dt className="text-xs text-zinc-500">Birth date / age</dt><dd className="mt-1 text-sm">{detail.courier.profile.birth_date ? `${detail.courier.profile.birth_date}${detail.courier.profile.age ? ` · ${detail.courier.profile.age} years old` : ''}` : 'Not provided'}</dd></div><div><dt className="text-xs text-zinc-500">Sex</dt><dd className="mt-1 text-sm capitalize">{detail.courier.profile.sex?.replaceAll('_', ' ') || 'Not provided'}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-zinc-500">Account status</dt><dd className="mt-1"><StatusBadge status={detail.courier.account_status} /></dd></div></dl></section>
          <section className={`${panel} p-5`}><h3 className="font-semibold">Submitted address</h3>{detail.courier.address ? <address className="mt-3 text-sm not-italic leading-6">{detail.courier.address.address_line_1}{detail.courier.address.address_line_2 ? <><br />{detail.courier.address.address_line_2}</> : null}<br />{detail.courier.address.barangay}, {detail.courier.address.city_municipality}<br />{detail.courier.address.province}, {detail.courier.address.region} {detail.courier.address.postal_code}<br />{detail.courier.address.country}</address> : <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Address not provided.</p>}</section>
          <section className={`${panel} p-5`}><h3 className="font-semibold">Vehicle</h3>{detail.courier.vehicle ? <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-3"><div><dt className="text-xs text-zinc-500">Type</dt><dd className="mt-1 text-sm capitalize">{statusLabel(detail.courier.vehicle.type)}</dd></div><div><dt className="text-xs text-zinc-500">Plate number</dt><dd className="mt-1 font-mono text-sm">{detail.courier.vehicle.plate_number || 'Not provided'}</dd></div><div><dt className="text-xs text-zinc-500">Vehicle status</dt><dd className="mt-1"><StatusBadge status={detail.courier.vehicle.status} /></dd></div></dl> : <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Vehicle details not provided.</p>}</section>
          <section className={`${panel} p-5`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Registration evidence</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Private evidence is loaded only after you request a preview.</p></div><span className={detail.completeness.complete ? 'text-sm text-emerald-700 dark:text-emerald-300' : 'text-sm text-amber-700 dark:text-amber-300'}>{detail.completeness.complete ? 'Complete' : `Missing ${detail.completeness.missing.length}`}</span></div><ul className="mt-4">{detail.documents.length ? detail.documents.map((document) => <EvidenceCard document={document} key={document.id} onPreview={() => void preview(document)} state={evidence[document.id] ?? { status: document.present ? 'idle' : 'missing' }} />) : <li className="mt-4 text-sm text-amber-700 dark:text-amber-300">No evidence records were submitted.</li>}</ul></section>
        </div>
        <aside className="space-y-5"><section className={`${panel} p-5`}><h3 className="font-semibold">Review</h3><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-zinc-500">Organization</dt><dd className="mt-1">{detail.organization.business_name || 'Unavailable'}</dd></div><div><dt className="text-xs text-zinc-500">Operational hub</dt><dd className="mt-1">{detail.organization.hub?.name || 'Unavailable'}</dd></div><div><dt className="text-xs text-zinc-500">Application status</dt><dd className="mt-1"><StatusBadge status={detail.application?.status} /></dd></div>{detail.review ? <><div><dt className="text-xs text-zinc-500">Reviewed</dt><dd className="mt-1">{manilaDate(detail.review.reviewed_at)}</dd></div><div><dt className="text-xs text-zinc-500">Reviewed by</dt><dd className="mt-1">{detail.review.reviewed_by?.name || detail.review.reviewed_by?.email || 'Logistics reviewer'}</dd></div>{detail.review.reason ? <div><dt className="text-xs text-zinc-500">Reason</dt><dd className="mt-1 leading-5">{detail.review.reason}</dd></div> : null}</> : <div><dt className="text-xs text-zinc-500">Decision</dt><dd className="mt-1">Pending Logistics review</dd></div>}</dl></section><section className={`${panel} p-5`}><h3 className="font-semibold">Review checklist</h3><ul className="mt-3 space-y-2 text-sm">{[['Profile', detail.completeness.profile_present], ['Address', detail.completeness.address_present], ['Vehicle', detail.completeness.vehicle_present], ['Required evidence', detail.completeness.required_documents.every((document) => document.present)]].map(([label, complete]) => <li className="flex items-center gap-2" key={String(label)}><span className={complete ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}>{complete ? '✓' : '!'}</span><span>{String(label)}</span></li>)}</ul><p className="mt-4 text-xs leading-5 text-zinc-500">Approval is recorded by the API only after all required records are present. Account suspension or deactivation remains an Admin lifecycle decision.</p></section></aside>
      </div>
    </> : null}
    <dialog aria-labelledby="courier-decision-title" className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-zinc-200 bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-white" onClose={() => { setDecision(null); trigger.current?.focus(); trigger.current = null }} ref={dialog}>
      <form className="p-5" onSubmit={(event) => void submitDecision(event)}><h3 id="courier-decision-title" className="text-lg font-semibold">{decision === 'approve' ? 'Approve Courier application?' : 'Reject Courier application?'}</h3><p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{decision === 'approve' ? 'This marks the affiliation and registration approved and activates the Courier account.' : 'The application and affiliation will be rejected. The Courier will not be able to sign in.'}</p>{decision === 'approve' && detail && !detail.completeness.complete ? <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">The API will reject this approval while required information or evidence is missing.</p> : null}{decision === 'reject' ? <><label className="mt-4 block text-sm font-medium" htmlFor="courier-rejection-reason">Reason <span className="text-red-600" aria-hidden="true">*</span></label><textarea aria-describedby={decisionFieldError ? 'courier-rejection-error' : undefined} aria-invalid={Boolean(decisionFieldError)} className={`${field} mt-1 h-28 py-2`} id="courier-rejection-reason" maxLength={2000} minLength={3} required value={reason} onChange={(event) => { setReason(event.target.value); setDecisionFieldError('') }} />{decisionFieldError ? <p className="mt-1 text-sm text-red-700 dark:text-red-300" id="courier-rejection-error">{decisionFieldError}</p> : null}<p className="mt-1 text-right text-xs text-zinc-500">{reason.length}/2000</p></> : null}{decisionError ? <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200" role="alert">{decisionError}</p> : null}<div className="mt-5 flex justify-end gap-2"><ActionButton disabled={busy} onClick={closeDecision} type="button">Cancel</ActionButton>{decision === 'approve' ? <PrimaryButton busy={busy} type="submit">Approve</PrimaryButton> : <ActionButton busy={busy} className="border-red-700! bg-red-700! text-white hover:bg-red-800!" type="submit">Reject</ActionButton>}</div></form>
    </dialog>
  </div>
}
