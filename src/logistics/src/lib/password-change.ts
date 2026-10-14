import type { PasswordDraft, PasswordChallenge, VerifiedPassword } from '@aisley/ui/password-change'
import { request, csrf } from './api'

const path = '/api/v1/logistics/account/password'

export async function requestPasswordCode(payload: PasswordDraft) {
  await csrf()
  return request<{ data: PasswordChallenge }>(`${path}/verification-code`, { method: 'POST', body: JSON.stringify(payload), cache: 'no-store' })
}

export async function updatePassword(payload: VerifiedPassword) {
  await csrf()
  return request<{ message: string }>(path, { method: 'PUT', body: JSON.stringify(payload) })
}
