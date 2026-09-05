import { useEffect, useState } from 'react'
import {
  FaArrowLeft,
  FaArrowUpRightFromSquare,
  FaCheck,
  FaDownload,
  FaFileLines,
  FaRotateRight,
  FaUser,
  FaXmark,
} from 'react-icons/fa6'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { DecisionDialog } from '../components/registrations/DecisionDialog'
import { StatusBadge } from '../components/registrations/StatusBadge'
import { ApiError, apiBlobRequest, apiRequest } from '../lib/api'
import {
  formatDate,
  formatFieldLabel,
  formatFileSize,
  roleLabel,
} from '../lib/registrations'
import type {
  RegistrationDetail,
  RegistrationDetailResponse,
} from '../types/registrations'

type RegistrationDocument = RegistrationDetail['documents'][number]

export function RegistrationDetailPage() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const { registrationId } = useParams()
  const [registration, setRegistration] = useState<RegistrationDetail | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    document.title = 'Registration review | Aisley Admin'
  }, [])

  useEffect(() => {
    if (!registrationId) return

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    apiRequest<RegistrationDetailResponse>(`/api/v1/admin/registrations/${registrationId}`, {
      signal: controller.signal,
    })
      .then((response) => setRegistration(response.data))
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true }))
          return
        }
        setError({
          status: requestError instanceof ApiError ? requestError.status : 0,
          message: requestError instanceof Error ? requestError.message : 'Unable to load this registration.',
        })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [logout, navigate, registrationId, reloadKey])

  async function decide(reason: string | null) {
    if (!registration || !dialog) return

    setIsSubmitting(true)
    setActionError(null)
    setNotice(null)

    try {
      const response = await apiRequest<RegistrationDetailResponse>(
        `/api/v1/admin/registrations/${registration.id}/${dialog}`,
        {
          method: 'POST',
          body: JSON.stringify(dialog === 'reject' ? { reason } : {}),
        },
      )
      setRegistration(response.data)
      setNotice(`Registration ${dialog === 'approve' ? 'approved' : 'rejected'} successfully. The applicant notification has been queued.`)
      setDialog(null)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        await logout()
        navigate('/login', { replace: true })
        return
      }

      if (requestError instanceof ApiError && requestError.status === 409) {
        setActionError('Another administrator has already reviewed this registration. The latest decision has been loaded.')
        setDialog(null)
        setReloadKey((value) => value + 1)
      } else {
        setActionError(requestError instanceof Error ? requestError.message : 'The decision could not be saved.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <DetailSkeleton />

  if (error || !registration) {
    return (
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-3xl place-items-center px-5 py-12 text-center sm:px-8">
        <div>
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
            <FaRotateRight aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">
            {error?.status === 404 ? 'Registration not found' : 'Unable to load registration'}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {error?.status === 403
              ? 'Your administrator account does not have permission to view registration details.'
              : error?.message ?? 'This registration is unavailable.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-white/10" to="/registrations">
              Back to queue
            </Link>
            {error?.status !== 404 && (
              <button className="rounded-xl bg-[#4C1268] px-4 py-2.5 text-sm font-semibold text-white" onClick={() => setReloadKey((value) => value + 1)} type="button">
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const canReview = registration.status === 'pending'
    && (admin?.permissions.includes('registrations.review') ?? false)

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#E6007A] dark:text-slate-400" to="/registrations">
        <FaArrowLeft aria-hidden="true" />
        Back to registrations
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{registration.applicant.name}</h2>
            <StatusBadge status={registration.status} />
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {roleLabel(registration.applicant.role)} application · Submitted {formatDate(registration.submitted_at)}
          </p>
        </div>

        {canReview && (
          <div className="flex shrink-0 gap-3">
            <button className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-400/20 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-400/10" onClick={() => setDialog('reject')} type="button">
              <FaXmark aria-hidden="true" />
              Reject
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700" onClick={() => setDialog('approve')} type="button">
              <FaCheck aria-hidden="true" />
              Approve
            </button>
          </div>
        )}
      </div>

      {notice && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300" role="status">
          {notice}
        </div>
      )}
      {actionError && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300" role="alert">
          {actionError}
        </div>
      )}

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-purple-50 text-[#4C1268] dark:bg-purple-400/10 dark:text-purple-300">
                <FaUser aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold">Applicant details</h3>
                <p className="text-xs text-slate-400">Information submitted for this role</p>
              </div>
            </div>

            <dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <DetailField label="Email" value={registration.applicant.email} />
              <DetailField label="Role" value={roleLabel(registration.applicant.role)} />
              <DetailField label="First name" value={registration.application.first_name} />
              <DetailField label="Middle name" value={registration.application.middle_name} />
              <DetailField label="Last name" value={registration.application.last_name} />
              <DetailField label="Contact number" value={registration.application.contact_number} />
              <DetailField label="Sex" value={registration.application.sex ? formatFieldLabel(registration.application.sex) : null} />
              <DetailField label="Birth date" value={registration.application.birth_date} />
              <DetailField label="Age" value={registration.application.age} />
              {registration.application.business && (
                <>
                  <DetailField label="Business name" value={registration.application.business.name} />
                  <DetailField label="Line of business" value={registration.application.business.category?.name ?? null} />
                  <DetailField label="Shop status" value={formatFieldLabel(registration.application.business.status)} />
                </>
              )}
              {registration.application.logistics_organization && (
                <>
                  <DetailField label="Business name" value={registration.application.logistics_organization.business_name} />
                  <DetailField label="Operational hub" value={registration.application.logistics_organization.hub_name} />
                </>
              )}
              {registration.application.address && (
                <DetailField
                  label={registration.applicant.role === 'logistics' ? 'Operational hub address' : 'Business address'}
                  value={[
                    registration.application.address.address_line_1,
                    registration.application.address.address_line_2,
                    registration.application.address.barangay,
                    registration.application.address.city_municipality,
                    registration.application.address.province,
                    registration.application.address.region,
                    registration.application.address.postal_code,
                    registration.application.address.country,
                  ].filter(Boolean).join(', ')}
                />
              )}
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-purple-50 text-[#4C1268] dark:bg-purple-400/10 dark:text-purple-300">
                <FaFileLines aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold">Submitted documents</h3>
                <p className="text-xs text-slate-400">Document metadata attached to this application</p>
              </div>
            </div>

            {registration.documents.length ? (
              <div className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-white/[0.07] dark:border-white/10">
                {registration.documents.map((document) => (
                  <DocumentPreview document={document} key={document.id} />
                ))}
              </div>
            ) : (
              <p className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-400 dark:border-white/10">
                No documents were submitted with this application.
              </p>
            )}
          </section>
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
          <h3 className="font-semibold">Review status</h3>
          <dl className="mt-5 space-y-4">
            <DetailField label="Application status" value={formatFieldLabel(registration.status)} />
            <DetailField label="Account status" value={formatFieldLabel(registration.applicant.account_status)} />
            <DetailField label="Submitted" value={formatDate(registration.submitted_at)} />
            {registration.review && (
              <>
                <DetailField label="Reviewed" value={formatDate(registration.review.reviewed_at)} />
                <DetailField label="Reviewed by" value={registration.review.reviewed_by?.name ?? 'Former administrator'} />
                {registration.review.rejection_reason && (
                  <DetailField label="Rejection reason" value={registration.review.rejection_reason} />
                )}
              </>
            )}
          </dl>
          {registration.status === 'pending' && !canReview && (
            <p className="mt-5 rounded-xl bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
              You can view this application, but you do not have permission to approve or reject it.
            </p>
          )}
        </aside>
      </div>

      <DecisionDialog
        applicantName={registration.applicant.name}
        decision={dialog ?? 'approve'}
        isOpen={dialog !== null}
        isSubmitting={isSubmitting}
        onClose={() => setDialog(null)}
        onConfirm={decide}
      />
    </div>
  )
}

function DocumentPreview({ document }: { document: RegistrationDocument }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null

    setIsPreviewLoading(true)
    setPreviewError(null)
    setPreviewUrl(null)

    apiBlobRequest(document.download_url, { signal: controller.signal })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) {
          setPreviewError(requestError instanceof Error ? requestError.message : 'The document preview could not be loaded.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsPreviewLoading(false)
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [document.download_url, reloadKey])

  return (
    <article className="grid gap-4 p-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center">
      <div className="flex min-h-44 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/20">
        {isPreviewLoading && (
          <div className="text-center text-xs text-slate-400" role="status">Loading secure preview…</div>
        )}
        {!isPreviewLoading && previewUrl && (
          <img
            alt={`${formatFieldLabel(document.type)} submitted for review`}
            className="max-h-72 w-full object-contain"
            src={previewUrl}
          />
        )}
        {!isPreviewLoading && previewError && (
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-medium text-rose-600 dark:text-rose-300">Preview unavailable</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{previewError}</p>
            <button
              className="mt-3 text-xs font-semibold text-[#b0005d] hover:text-[#E6007A] dark:text-pink-300"
              onClick={() => setReloadKey((value) => value + 1)}
              type="button"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{document.original_name}</p>
        <p className="mt-1 text-xs text-slate-400">
          {formatFieldLabel(document.type)} · {document.mime_type} · {formatFileSize(document.size_bytes)}
        </p>
        <p className="mt-3 text-xs font-semibold capitalize text-slate-500 dark:text-slate-300">
          Review status: {document.status}
        </p>

        {previewUrl && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:border-[#E6007A] hover:text-[#E6007A] dark:border-white/10"
              href={previewUrl}
              rel="noreferrer"
              target="_blank"
            >
              <FaArrowUpRightFromSquare aria-hidden="true" />
              Open full size
            </a>
            <a
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:border-[#E6007A] hover:text-[#E6007A] dark:border-white/10"
              download={document.original_name}
              href={previewUrl}
            >
              <FaDownload aria-hidden="true" />
              Download
            </a>
          </div>
        )}
      </div>
    </article>
  )
}

function DetailField({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-medium text-slate-700 dark:text-slate-200">{value ?? 'Not provided'}</dd>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-5 py-10 sm:px-8" aria-label="Loading registration" aria-live="polite">
      <div className="h-4 w-36 rounded bg-slate-200 dark:bg-white/10" />
      <div className="mt-8 h-9 w-72 rounded bg-slate-200 dark:bg-white/10" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-slate-100 dark:bg-white/5" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="h-96 rounded-2xl bg-white shadow-sm dark:bg-white/[0.035]" />
        <div className="h-72 rounded-2xl bg-white shadow-sm dark:bg-white/[0.035]" />
      </div>
    </div>
  )
}
