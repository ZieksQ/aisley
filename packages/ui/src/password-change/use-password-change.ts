"use client";

import { useEffect, useRef, useState } from "react";
import type { PasswordChallenge, PasswordChangeProps, PasswordDraft } from "./types";

const empty: PasswordDraft = { current_password: "", password: "", password_confirmation: "" };

function failure(error: unknown) {
  const value = error as { status?: number; message?: string; errors?: Record<string, string[]>; retryAfter?: number };
  return {
    status: value?.status ?? 0,
    message: value?.message ?? "We could not reach the service. Try again.",
    fields: value?.errors ?? {},
    retryAfter: value?.retryAfter ?? 60,
  };
}

export function usePasswordChange(props: PasswordChangeProps) {
  const [draft, setDraft] = useState(empty);
  const [challenge, setChallenge] = useState<PasswordChallenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [uncertain, setUncertain] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const epoch = useRef(0);
  const pending = useRef(false);
  const feedback = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(timer); epoch.current++; };
  }, []);

  const remaining = Math.max(0, Math.ceil((Math.max(blockedUntil, challenge ? Date.parse(challenge.resend_available_at) : 0) - now) / 1000));
  const expired = !!challenge && Date.parse(challenge.expires_at) <= now;

  function cancel() {
    if (pending.current) return;
    epoch.current++;
    setDraft(empty);
    setCode("");
    setChallenge(null);
    setErrors({});
    if (!uncertain) setMessage(null);
  }

  async function perform(verify: boolean) {
    if (pending.current || uncertain || blockedUntil > Date.now()) return;
    if (!verify && remaining > 0) return;
    if (verify && (!challenge || expired)) return;
    pending.current = true;
    const generation = ++epoch.current;
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      if (verify && challenge) {
        const result = await props.updatePassword({ ...draft, challenge_id: challenge.challenge_id, verification_code: code });
        if (generation !== epoch.current) return;
        setDraft(empty);
        setChallenge(null);
        setCode("");
        setMessage(result.message);
        props.onSuccess?.();
      } else {
        const result = await props.requestCode(draft);
        if (generation !== epoch.current) return;
        const next = result.data;
        if (!next?.challenge_id || !next.masked_email || !Number.isFinite(Date.parse(next.expires_at)) || !Number.isFinite(Date.parse(next.resend_available_at))) {
          throw new Error("Unexpected verification response. Please request a fresh code after one minute.");
        }
        setChallenge(next);
        setCode("");
        setMessage("Your verification email is queued. Check your inbox and spam folder.");
      }
    } catch (error) {
      if (generation !== epoch.current) return;
      const result = failure(error);
      props.onError?.(error);
      if (result.status === 401 || result.status === 403) {
        setDraft(empty);
        setCode("");
        setChallenge(null);
      }
      setErrors(result.fields);
      if (result.status === 429) setBlockedUntil(Date.now() + result.retryAfter * 1000);
      if (verify && (result.status === 0 || result.status >= 500 || result.status === 408)) {
        setUncertain(true);
        setDraft(empty);
        setCode("");
        setChallenge(null);
        setMessage("The password change outcome is uncertain. Sign out and check sign-in with the password you believe is current before another change.");
      } else {
        if (!verify && (result.status === 0 || result.status >= 500)) setBlockedUntil(Date.now() + 60000);
        setMessage(result.message);
      }
    } finally {
      if (generation === epoch.current) {
        pending.current = false;
        setBusy(false);
        setTimeout(() => feedback.current?.focus(), 0);
      }
    }
  }

  return { draft, setDraft, challenge, code, setCode, busy, message, errors, uncertain, remaining, expired, cancel, perform, feedback, coolingDown: blockedUntil > now };
}
