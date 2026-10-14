import type { PasswordDraft, PasswordChallenge, VerifiedPassword } from '@aisley/ui/password-change'
import { apiRequest, initializeCsrf } from './api'

const path = '/api/v1/seller/account/password'

export async function requestPasswordCode(payload: PasswordDraft) {
  await initializeCsrf()
  return apiRequest<{ data: PasswordChallenge }>(`${path}/verification-code`, { method: 'POST', body: JSON.stringify(payload), cache: 'no-store' })
}

export async function updatePassword(payload: VerifiedPassword) {
  await initializeCsrf()
  return apiRequest<{ message: string }>(path, { method: 'PUT', body: JSON.stringify(payload) })
}
