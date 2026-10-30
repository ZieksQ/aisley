export type RegistrationEmailChallenge = {
  challenge_id: string;
  expires_at: string;
  resend_available_at: string;
};

export type RegistrationEmailProof = {
  email_verification_token: string;
  expires_at: string;
};

export type RegistrationEmailClient = {
  requestCode: (email: string, signal: AbortSignal) => Promise<RegistrationEmailChallenge>;
  verifyCode: (email: string, challengeId: string, code: string, signal: AbortSignal) => Promise<RegistrationEmailProof>;
};

export type RegistrationSubmission = {
  email: string;
  token: string;
  signal: AbortSignal;
  isCurrent: () => boolean;
  complete: () => boolean;
  finish: (failure?: { reverify?: boolean; message?: string }) => void;
};

export type VerifiedRegistrationEmail = {
  email: string;
  token: string;
  submitting: boolean;
  beginSubmission: () => RegistrationSubmission | null;
  setEmail: (email: string) => void;
  continueToVerification: () => boolean;
};
