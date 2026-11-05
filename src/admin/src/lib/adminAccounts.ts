import { apiRequest } from './api'
import type {
  AdminAccountDraft,
  AdminRole,
  ManagedAdmin,
  PermissionDefinition,
  SetupChallenge,
} from '../types/adminAccounts'
import type { AuthResponse } from '../types/auth'
const base = '/api/v1/admin'
export const fetchAdminAccounts = (query: string, signal?: AbortSignal) =>
  apiRequest<{
    data: ManagedAdmin[]
    meta: { current_page: number; last_page: number; total: number }
  }>(`${base}/admin-accounts?${query}`, { signal })
export const fetchManagedAdmin = (id: string, signal?: AbortSignal) =>
  apiRequest<{ data: ManagedAdmin }>(`${base}/admin-accounts/${id}`, { signal })
export const fetchAdminRoles = (signal?: AbortSignal) =>
  apiRequest<{ data: AdminRole[] }>(`${base}/admin-roles`, { signal })
export const fetchPermissions = (signal?: AbortSignal) =>
  apiRequest<{ data: PermissionDefinition[] }>(`${base}/permissions`, { signal })
export const saveAdminAccount = (draft: AdminAccountDraft, id?: string) =>
  apiRequest<{ data: ManagedAdmin }>(`${base}/admin-accounts${id ? `/${id}` : ''}`, {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(draft),
  })
export const actOnAdmin = (account: ManagedAdmin, operation: string, currentPassword: string) =>
  apiRequest(`${base}/admin-accounts/${account.id}/${operation}`, {
    method: 'POST',
    body: JSON.stringify({ revision: account.revision, current_password: currentPassword }),
  })
export const saveAdminRole = (
  draft: { name: string; permissions: string[]; current_password: string; revision?: number },
  id?: string,
) =>
  apiRequest<{ data: AdminRole }>(`${base}/admin-roles${id ? `/${id}` : ''}`, {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(draft),
  })
export const deleteAdminRole = (role: AdminRole, currentPassword: string) =>
  apiRequest(`${base}/admin-roles/${role.id}`, {
    method: 'DELETE',
    body: JSON.stringify({ revision: role.revision, current_password: currentPassword }),
  })
export const requestSetupCode = (draft: Record<string, string>) =>
  apiRequest<{ data: SetupChallenge }>(`${base}/auth/setup/code`, {
    method: 'POST',
    body: JSON.stringify(draft),
  })
export const completeAdminSetup = (draft: Record<string, string>) =>
  apiRequest<AuthResponse>(`${base}/auth/setup/complete`, {
    method: 'POST',
    body: JSON.stringify(draft),
  })
