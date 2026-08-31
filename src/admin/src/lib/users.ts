import { apiRequest } from './api'
import type {
  AccountLifecycleHistoryResponse,
  LifecycleAction,
  ManagedUserDetailResponse,
  ManagedUserListResponse,
  ManagedUserRole,
  ManagedUserStatus,
} from '../types/users'

export function fetchManagedUsers(query: URLSearchParams, signal?: AbortSignal) {
  return apiRequest<ManagedUserListResponse>(`/api/v1/admin/users?${query}`, { signal })
}

export function fetchManagedUser(id: string, signal?: AbortSignal) {
  return apiRequest<ManagedUserDetailResponse>(`/api/v1/admin/users/${id}`, { signal })
}

export function fetchManagedUserHistory(id: string, page = 1, signal?: AbortSignal) {
  return apiRequest<AccountLifecycleHistoryResponse>(`/api/v1/admin/users/${id}/history?page=${page}&per_page=20`, { signal })
}

export function changeManagedUserStatus(
  id: string,
  action: 'suspend' | 'restore' | 'deactivate',
  expectedStatus: ManagedUserStatus,
  reason: string | null,
) {
  return apiRequest<ManagedUserDetailResponse>(`/api/v1/admin/users/${id}/${action}`, {
    method: 'POST',
    body: JSON.stringify({ expected_status: expectedStatus, reason }),
  })
}

export function roleLabel(role: ManagedUserRole) {
  return role === 'customer' ? 'Customer' : role === 'seller' ? 'Seller' : 'Courier'
}

export function statusLabel(status: ManagedUserStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function lifecycleLabel(action: LifecycleAction) {
  return action === 'suspended' ? 'Suspended' : action === 'restored' ? 'Restored' : 'Deactivated'
}

export function formatUserDate(value: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}
