export type PasswordDraft = {
  current_password: string;
  password: string;
  password_confirmation: string;
};

export type PasswordChallenge = {
  challenge_id: string;
  masked_email: string;
  expires_at: string;
  resend_available_at: string;
};

export type VerifiedPassword = PasswordDraft & {
  challenge_id: string;
  verification_code: string;
};

export type PasswordChangeProps = {
  requestCode: (draft: PasswordDraft) => Promise<{ data: PasswordChallenge }>;
  updatePassword: (payload: VerifiedPassword) => Promise<{ message: string }>;
  sessionDescription: string;
  accent?: "purple" | "blue";
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
};
