import type { RegistrationRole, RegistrationStatus } from '../types/registrations'

export function roleLabel(role: RegistrationRole) {
  return role === 'customer' ? 'Customer' : role === 'seller' ? 'Seller' : 'Logistics'
}

export function statusLabel(status: RegistrationStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function formatDate(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatFieldLabel(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
