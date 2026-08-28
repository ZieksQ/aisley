import type { AuditJsonValue, AuditLogSummary } from '../types/auditLogs'

export function formatAuditDate(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value))
}

export function shortId(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

export function targetDescription(audit: AuditLogSummary) {
  const snapshot = audit.target.snapshot
  const registrationId = snapshot.registration_id
  const accountId = snapshot.account_id

  if (typeof registrationId === 'string') return shortId(registrationId)
  if (typeof accountId === 'string') return shortId(accountId)

  return shortId(audit.target.id)
}

export function formatAuditValue(value: AuditJsonValue | undefined) {
  if (value === undefined) return 'Not recorded'
  if (value === null) return 'None'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string' || typeof value === 'number') return String(value)

  return JSON.stringify(value, null, 2)
}

export function fieldLabel(value: string) {
  return value
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}
