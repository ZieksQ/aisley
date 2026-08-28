import { useEffect, useState } from 'react'
import {
  FaArrowLeft,
  FaClock,
  FaCodeCompare,
  FaFingerprint,
  FaRotateRight,
  FaShieldHalved,
  FaUserShield,
} from 'react-icons/fa6'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError, apiRequest } from '../lib/api'
import { fieldLabel, formatAuditDate, formatAuditValue } from '../lib/auditLogs'
import type {
  AuditJsonValue,
  AuditLogDetail,
  AuditLogDetailResponse,
} from '../types/auditLogs'

export function AuditLogDetailPage() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const { auditLogId } = useParams()
  const [audit, setAudit] = useState<AuditLogDetail | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    document.title = 'Audit event | Aisley Admin'
  }, [])

  useEffect(() => {
    if (!auditLogId) return

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    apiRequest<AuditLogDetailResponse>(`/api/v1/admin/audit-logs/${auditLogId}`, {
      signal: controller.signal,
    })
      .then((response) => setAudit(response.data))
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          void logout().finally(() => navigate('/login', { replace: true }))
          return
        }
        setError({
          status: requestError instanceof ApiError ? requestError.status : 0,
          message: requestError instanceof Error ? requestError.message : 'Unable to load this audit event.',
        })
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [auditLogId, logout, navigate, reloadKey])

  if (isLoading) return <AuditDetailSkeleton />

  if (error || !audit) {
    return (
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-3xl place-items-center px-5 py-12 text-center sm:px-8">
        <div>
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300">
            <FaRotateRight aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">{error?.status === 404 ? 'Audit event not found' : 'Unable to load audit event'}</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {error?.status === 403
              ? 'Your administrator account does not have permission to view audit event details.'
              : error?.message ?? 'This audit event is unavailable.'}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-white/10" to="/audit-logs">Back to audit logs</Link>
            {error?.status !== 404 && <button className="rounded-xl bg-[#4C1268] px-4 py-2.5 text-sm font-semibold text-white" onClick={() => setReloadKey((value) => value + 1)} type="button">Try again</button>}
          </div>
        </div>
      </div>
    )
  }

  const changedFields = Array.from(new Set([
    ...audit.changes.fields,
    ...Object.keys(audit.changes.before),
    ...Object.keys(audit.changes.after),
  ]))
  const canOpenTarget = audit.target.type === 'registration_application'
    && (admin?.permissions.includes('registrations.view') ?? false)

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-[#E6007A] dark:text-slate-400" to="/audit-logs">
        <FaArrowLeft aria-hidden="true" />
        Back to audit logs
      </Link>

      <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{audit.action_label}</h2>
            <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-[#4C1268] dark:bg-purple-400/10 dark:text-purple-200">Read only</span>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {audit.source_feature_label} · Occurred {formatAuditDate(audit.occurred_at)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.035]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Event ID</p>
          <p className="mt-1 break-all font-mono text-xs text-slate-600 dark:text-slate-300">{audit.event_id}</p>
        </div>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
            <SectionHeading icon={<FaCodeCompare aria-hidden="true" />} subtitle="The fields captured before and after this action" title="Recorded changes" />
            {changedFields.length ? (
              <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                <div className="hidden grid-cols-[0.8fr_1fr_1fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:bg-white/[0.025] sm:grid">
                  <span>Field</span><span>Before</span><span>After</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/[0.07]">
                  {changedFields.map((field) => (
                    <div className="grid gap-3 px-4 py-4 sm:grid-cols-[0.8fr_1fr_1fr]" key={field}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 sm:text-sm sm:normal-case sm:tracking-normal">{fieldLabel(field)}</p>
                      <AuditValue label="Before" value={audit.changes.before[field]} />
                      <AuditValue label="After" value={audit.changes.after[field]} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center text-sm text-slate-400 dark:border-white/10">No field-level changes were recorded for this event.</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035] sm:p-6">
            <SectionHeading icon={<FaFingerprint aria-hidden="true" />} subtitle="Safe contextual information retained with the event" title="Event metadata" />
            <dl className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              {Object.entries(audit.metadata).length ? Object.entries(audit.metadata).map(([key, value]) => (
                <DetailField key={key} label={fieldLabel(key)} value={formatAuditValue(value)} />
              )) : <p className="text-sm text-slate-400">No additional metadata was recorded.</p>}
            </dl>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
            <SectionHeading icon={<FaUserShield aria-hidden="true" />} subtitle="Administrator attribution" title="Actor" compact />
            <dl className="mt-5 space-y-4">
              <DetailField label="Name" value={`${audit.actor.name}${audit.actor.id === admin?.id ? ' (You)' : ''}`} />
              <DetailField label="Email" value={audit.actor.email ?? 'Unavailable'} />
              <DetailField label="Administrator ID" value={audit.actor.id ?? 'Unavailable'} mono />
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
            <SectionHeading icon={<FaShieldHalved aria-hidden="true" />} subtitle="Object affected by the action" title="Target" compact />
            <dl className="mt-5 space-y-4">
              <DetailField label="Type" value={audit.target.type_label} />
              <DetailField label="Target ID" value={audit.target.id} mono />
              {Object.entries(audit.target.snapshot).map(([key, value]) => (
                <DetailField key={key} label={fieldLabel(key)} value={formatAuditValue(value)} />
              ))}
            </dl>
            {canOpenTarget && (
              <Link className="mt-5 inline-flex text-sm font-semibold text-[#b0005d] hover:text-[#E6007A] dark:text-pink-300" to={`/registrations/${audit.target.id}`}>
                Open registration
              </Link>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
            <SectionHeading icon={<FaClock aria-hidden="true" />} subtitle="Event and persistence timing" title="Record context" compact />
            <dl className="mt-5 space-y-4">
              <DetailField label="Occurred" value={formatAuditDate(audit.occurred_at)} />
              <DetailField label="Recorded" value={formatAuditDate(audit.recorded_at)} />
              <DetailField label="Request ID" value={audit.request_context.request_id ?? 'Not recorded'} mono />
              <DetailField label="IP address" value={audit.request_context.ip_address ?? 'Not recorded'} mono />
              <DetailField label="User agent" value={audit.request_context.user_agent ?? 'Not recorded'} />
              <DetailField label="Schema version" value={String(audit.schema_version)} />
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}

function SectionHeading({ compact = false, icon, subtitle, title }: {
  compact?: boolean
  icon: React.ReactNode
  subtitle: string
  title: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${compact ? 'size-9' : 'size-10'} grid shrink-0 place-items-center rounded-xl bg-purple-50 text-[#4C1268] dark:bg-purple-400/10 dark:text-purple-300`}>
        {icon}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>
    </div>
  )
}

function AuditValue({ label, value }: { label: string; value: AuditJsonValue | undefined }) {
  const formatted = formatAuditValue(value)
  const isStructured = typeof value === 'object' && value !== null

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 sm:hidden">{label}</p>
      <p className={`${isStructured ? 'whitespace-pre-wrap font-mono text-xs' : 'text-sm'} mt-1 break-words text-slate-700 dark:text-slate-200 sm:mt-0`}>{formatted}</p>
    </div>
  )
}

function DetailField({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className={`${mono ? 'font-mono text-xs' : 'text-sm font-medium'} mt-1.5 break-words whitespace-pre-wrap text-slate-700 dark:text-slate-200`}>{value}</dd>
    </div>
  )
}

function AuditDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-5 py-10 sm:px-8" aria-label="Loading audit event" aria-live="polite">
      <div className="h-4 w-32 rounded bg-slate-200 dark:bg-white/10" />
      <div className="mt-8 h-9 w-72 rounded bg-slate-200 dark:bg-white/10" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-slate-100 dark:bg-white/5" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="h-96 rounded-2xl bg-white shadow-sm dark:bg-white/[0.035]" />
        <div className="h-72 rounded-2xl bg-white shadow-sm dark:bg-white/[0.035]" />
      </div>
    </div>
  )
}
