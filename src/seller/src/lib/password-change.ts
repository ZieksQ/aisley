import type { PasswordDraft, PasswordChallenge, VerifiedPassword, PasswordRequestContext } from '@aisley/ui/password-change'
import { apiRequest, initializeCsrf } from './api'

const path = '/api/v1/seller/account/password'

export async function requestPasswordCode(payload: PasswordDraft, context?: PasswordRequestContext) {
  await initializeCsrf(context?.signal)
  if (context && (!context.isCurrent() || context.signal.aborted)) throw new Error("This password request is no longer current.");
  return apiRequest<{ data: PasswordChallenge }>(`${path}/verification-code`, { method: 'POST', signal: context?.signal, body: JSON.stringify(payload), cache: 'no-store' })
}

export async function updatePassword(payload: VerifiedPassword, context?: PasswordRequestContext) {
  await initializeCsrf(context?.signal)
  if (context && (!context.isCurrent() || context.signal.aborted)) throw new Error("This password request is no longer current.");
  return apiRequest<{ message: string }>(path, { method: 'PUT', signal: context?.signal, body: JSON.stringify(payload) })
}
