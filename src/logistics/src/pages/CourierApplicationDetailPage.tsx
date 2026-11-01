import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import { FaArrowLeft, FaArrowsRotate, FaCheck, FaTriangleExclamation, FaXmark } from 'react-icons/fa6'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { EvidenceCard, type EvidenceState } from '../features/courierApplications/ApplicationEvidence'
import { StatusBadge, statusLabel } from '../features/courierApplications/ApplicationStatus'
import { ErrorNotice, manilaDate } from '../components/PickupUi'
import { PortalButton } from '@aisley/ui/portal'
import { ApiError, blob, csrf, requestWithTimeout } from '../lib/api'
import type { CourierApplicationDetail, CourierApplicationDetailResponse, CourierApplicationDocument } from '../types/courierApplications'

type Decision = 'approve' | 'reject'


function displayName(detail: CourierApplicationDetail): string {
  const profile = detail.courier.profile
  return [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') || detail.courier.email || 'Courier applicant'
}

export function CourierApplicationDetailPage() {
  const [listParams] = useSearchParams()
  const backParams = new URLSearchParams()
  for (const key of ['search', 'page']) {
    const value = listParams.get(key)
    if (value) backParams.set(key, value)
  }
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

  if (loading && !detail) return <div className="p-6 text-sm" role="status">
    Loading Courier application…
  </div>

  return <div className="portal-page">
    <Link
      className={`inline-flex min-h-11 items-center font-medium text-[var(--portal-accent)] underline-offset-4 hover:underline inline-flex items-center gap-2 text-sm`}
      ref={backButton}
      to={`/courier-applications?${backParams.toString()}`}>
      <FaArrowLeft aria-hidden="true" />
      Back to applications
    </Link>
    {error ? <div className="mt-5">
      <ErrorNotice message={error} retry={() => void load()} />
    </div> : null}
    {detail ? <>
      <div
        className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--portal-border)] pb-5 dark:border-[var(--portal-border)]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="portal-page-heading">{displayName(detail)}</h2>
            <StatusBadge status={detail.status} />
          </div>
          <p className="mt-1 text-sm text-[var(--portal-muted)]">{detail.courier.email} · Submitted {manilaDate(detail.application?.submitted_at ?? detail.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {detail.status === 'pending' ? <><PortalButton onClick={(event) => openDecision('reject', event)}>
            <FaXmark aria-hidden="true" />
            Reject
          </PortalButton><PortalButton
            variant="primary"
            disabled={!detail.completeness.complete}
            onClick={(event) => openDecision('approve', event)}>
              <FaCheck aria-hidden="true" />
              Approve
            </PortalButton></> : <PortalButton isLoading={loading} onClick={() => void load()}>
            <FaArrowsRotate aria-hidden="true" />
            Refresh
          </PortalButton>}
        </div>
      </div>
      {notice ? <p
        className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
        role="status">{notice}</p> : null}
      {detail.status === 'pending' && !detail.completeness.complete ? <div
        className="mt-4 flex gap-3 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">
        <FaTriangleExclamation aria-hidden="true" className="mt-0.5 shrink-0" />
        <p><strong>Application incomplete.</strong> Approval is unavailable until {detail.completeness.missing.join(', ').replaceAll('_', ' ')} is provided and readable.</p>
      </div> : null}
      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          <section className={`rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5`}>
            <h3 className="font-semibold">Applicant details</h3>
            <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--portal-muted)]">Full name</dt>
                <dd className="mt-1 text-sm">{displayName(detail)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--portal-muted)]">Contact number</dt>
                <dd className="mt-1 text-sm">{detail.courier.profile.contact_number || 'Not provided'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--portal-muted)]">Birth date / age</dt>
                <dd className="mt-1 text-sm">{detail.courier.profile.birth_date ? `${detail.courier.profile.birth_date}${detail.courier.profile.age ? ` · ${detail.courier.profile.age} years old` : ''}` : 'Not provided'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--portal-muted)]">Sex</dt>
                <dd className="mt-1 text-sm capitalize">{detail.courier.profile.sex?.replaceAll('_', ' ') || 'Not provided'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--portal-muted)]">Account status</dt>
                <dd className="mt-1"><StatusBadge status={detail.courier.account_status} /></dd>
              </div>
            </dl>
          </section>
          <section className={`rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5`}>
            <h3 className="font-semibold">Submitted address</h3>
            {detail.courier.address ? <address className="mt-3 text-sm not-italic leading-6">{detail.courier.address.address_line_1}{detail.courier.address.address_line_2 ? <><br />{detail.courier.address.address_line_2}</> : null}<br />{detail.courier.address.barangay}, {detail.courier.address.city_municipality}<br />{detail.courier.address.province}, {detail.courier.address.region} {detail.courier.address.postal_code}<br />{detail.courier.address.country}</address> : <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Address not provided.</p>}
          </section>
          <section className={`rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5`}>
            <h3 className="font-semibold">Vehicle</h3>
            {detail.courier.vehicle ? <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-[var(--portal-muted)]">Type</dt>
                <dd className="mt-1 text-sm capitalize">{statusLabel(detail.courier.vehicle.type)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--portal-muted)]">Plate number</dt>
                <dd className="mt-1 font-mono text-sm">{detail.courier.vehicle.plate_number || 'Not provided'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--portal-muted)]">Vehicle status</dt>
                <dd className="mt-1"><StatusBadge status={detail.courier.vehicle.status} /></dd>
              </div>
            </dl> : <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">Vehicle details not provided.</p>}
          </section>
          <section className={`rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Registration evidence</h3>
                <p className="mt-1 text-sm text-[var(--portal-muted)]">Private evidence is loaded only after you request a preview.</p>
              </div>
              <span
                className={detail.completeness.complete ? 'text-sm text-emerald-700 dark:text-emerald-300' : 'text-sm text-amber-700 dark:text-amber-300'}>{detail.completeness.complete ? 'Complete' : `Missing ${detail.completeness.missing.length}`}</span>
            </div>
            <ul className="mt-4">
              {detail.documents.length ? detail.documents.map((document) => <EvidenceCard
                document={document}
                key={document.id}
                onPreview={() => void preview(document)}
                state={evidence[document.id] ?? { status: document.present ? 'idle' : 'missing' }} />) : <li className="mt-4 text-sm text-amber-700 dark:text-amber-300">
                No evidence records were submitted.
              </li>}
            </ul>
          </section>
        </div>
        <aside className="space-y-5">
          <section className={`rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5`}>
            <h3 className="font-semibold">Review</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-[var(--portal-muted)]">Organization</dt>
                <dd className="mt-1">{detail.organization.business_name || 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--portal-muted)]">Operational hub</dt>
                <dd className="mt-1">{detail.organization.hub?.name || 'Unavailable'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--portal-muted)]">Application status</dt>
                <dd className="mt-1"><StatusBadge status={detail.application?.status} /></dd>
              </div>
              {detail.review ? <><div>
                <dt className="text-xs text-[var(--portal-muted)]">Reviewed</dt>
                <dd className="mt-1">{manilaDate(detail.review.reviewed_at)}</dd>
              </div><div>
                  <dt className="text-xs text-[var(--portal-muted)]">Reviewed by</dt>
                  <dd className="mt-1">{detail.review.reviewed_by?.name || detail.review.reviewed_by?.email || 'Logistics reviewer'}</dd>
                </div>{detail.review.reason ? <div>
                  <dt className="text-xs text-[var(--portal-muted)]">Reason</dt>
                  <dd className="mt-1 leading-5">{detail.review.reason}</dd>
                </div> : null}</> : <div>
                <dt className="text-xs text-[var(--portal-muted)]">Decision</dt>
                <dd className="mt-1">Pending Logistics review</dd>
              </div>}
            </dl>
          </section>
          <section className={`rounded-xl border border-[var(--portal-border)] bg-[var(--portal-surface)] p-5`}>
            <h3 className="font-semibold">Review checklist</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {[['Profile', detail.completeness.profile_present], ['Address', detail.completeness.address_present], ['Vehicle', detail.completeness.vehicle_present], ['Required evidence', detail.completeness.required_documents.every((document) => document.present)]].map(([label, complete]) => <li className="flex items-center gap-2" key={String(label)}>
                <span className={complete ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}>{complete ? '✓' : '!'}</span>
                <span>{String(label)}</span>
              </li>)}
            </ul>
            <p className="mt-4 text-xs leading-5 text-[var(--portal-muted)]">Approval is recorded by the API only after all required records are present. Account suspension or deactivation remains an Admin lifecycle decision.</p>
          </section>
        </aside>
      </div>
    </> : null}
    <dialog
      onCancel={(event) => { event.preventDefault(); closeDecision() }}
      aria-labelledby="courier-decision-title"
      className="m-auto w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto max-w-lg rounded-lg border border-[var(--portal-border)] bg-white p-0 text-zinc-950 backdrop:bg-black/55 dark:border-slate-500 dark:bg-[var(--portal-surface)] dark:text-white"
      onClose={() => { setDecision(null); trigger.current?.focus(); trigger.current = null }}
      ref={dialog}>
      <form className="p-5" onSubmit={(event) => void submitDecision(event)}>
        <h3 id="courier-decision-title" className="text-lg font-semibold">{decision === 'approve' ? 'Approve Courier application?' : 'Reject Courier application?'}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--portal-muted)]">{decision === 'approve' ? 'This marks the affiliation and registration approved and activates the Courier account.' : 'The application and affiliation will be rejected. The Courier will not be able to sign in.'}</p>
        {decision === 'approve' && detail && !detail.completeness.complete ? <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">The API will reject this approval while required information or evidence is missing.</p> : null}
        {decision === 'reject' ? <><label className="mt-4 block text-sm font-medium" htmlFor="courier-rejection-reason">Reason <span className="text-red-600" aria-hidden="true">*</span></label><textarea
          aria-describedby={decisionFieldError ? 'courier-rejection-error' : undefined}
          aria-invalid={Boolean(decisionFieldError)}
          className={`min-h-11 w-full rounded-lg border border-slate-400 bg-[var(--portal-surface)] px-3 text-sm focus-visible:outline-[var(--brand-focus)] dark:border-slate-500 mt-1 h-28 py-2`}
          id="courier-rejection-reason"
          maxLength={2000}
          minLength={3}
          required
          value={reason}
          onChange={(event) => { setReason(event.target.value); setDecisionFieldError('') }} />{decisionFieldError ? <p className="mt-1 text-sm text-red-700 dark:text-red-300" id="courier-rejection-error">{decisionFieldError}</p> : null}<p className="mt-1 text-right text-xs text-[var(--portal-muted)]">{reason.length}/2000</p></> : null}
        {decisionError ? <p
          className="mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200"
          role="alert">{decisionError}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <PortalButton disabled={busy} onClick={closeDecision} type="button">
            Cancel
          </PortalButton>
          {decision === 'approve' ? <PortalButton variant="primary" isLoading={busy} type="submit">
            Approve
          </PortalButton> : <PortalButton
            isLoading={busy}
            className="border-red-700! bg-red-700! text-white hover:bg-red-800!"
            type="submit">
            Reject
          </PortalButton>}
        </div>
      </form>
    </dialog>
  </div>
}
