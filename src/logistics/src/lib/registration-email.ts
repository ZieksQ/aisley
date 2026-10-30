import type { RegistrationEmailClient, RegistrationEmailChallenge, RegistrationEmailProof } from '@aisley/ui/registration-email';
import { request, csrf } from './api';

async function send<T>(action: string, body: Record<string, string>, signal: AbortSignal): Promise<T> {
  await csrf();
  return request<T>(`/api/v1/logistics/auth/registration/${action}`, { method: 'POST', body: JSON.stringify(body), signal });
}

export const registrationEmailClient: RegistrationEmailClient = {
  getConfig: (signal) => request<{ email_verification_required: boolean }>(`/api/v1/logistics/auth/registration/config`, { signal }),
  requestCode: (email, signal) => send<RegistrationEmailChallenge>('verification-code', { email }, signal),
  verifyCode: (email, challenge_id, verification_code, signal) => send<RegistrationEmailProof>('verify-email', { email, challenge_id, verification_code }, signal),
};
