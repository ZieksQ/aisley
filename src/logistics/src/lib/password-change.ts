import type { PasswordDraft, PasswordChallenge, VerifiedPassword, PasswordRequestContext } from '@aisley/ui/password-change'
import { request, csrf } from './api'

const path = '/api/v1/logistics/account/password'

export async function requestPasswordCode(payload: PasswordDraft, context?: PasswordRequestContext) {
  await csrf(context?.signal)
  if (context && (!context.isCurrent() || context.signal.aborted)) throw new Error("This password request is no longer current.");
  return request<{ data: PasswordChallenge }>(`${path}/verification-code`, { method: 'POST', signal: context?.signal, body: JSON.stringify(payload), cache: 'no-store' })
}

export async function updatePassword(payload: VerifiedPassword, context?: PasswordRequestContext) {
  await csrf(context?.signal)
  if (context && (!context.isCurrent() || context.signal.aborted)) throw new Error("This password request is no longer current.");
  return request<{ message: string }>(path, { method: 'PUT', signal: context?.signal, body: JSON.stringify(payload) })
}
