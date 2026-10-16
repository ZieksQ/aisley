import type { RegistrationEmailClient, RegistrationEmailChallenge, RegistrationEmailProof } from '@aisley/ui/registration-email';
import { apiRequest, initializeCsrf } from './api';

async function send<T>(action: string, body: Record<string, string>, signal: AbortSignal): Promise<T> {
  await initializeCsrf();
  return apiRequest<T>(`/api/v1/seller/auth/registration/${action}`, { method: 'POST', body: JSON.stringify(body), signal });
}

export const registrationEmailClient: RegistrationEmailClient = {
  requestCode: (email, signal) => send<RegistrationEmailChallenge>('verification-code', { email }, signal),
  verifyCode: (email, challenge_id, verification_code, signal) => send<RegistrationEmailProof>('verify-email', { email, challenge_id, verification_code }, signal),
};
