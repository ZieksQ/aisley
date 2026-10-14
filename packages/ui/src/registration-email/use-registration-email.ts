"use client";

import { useEffect, useRef, useState } from "react";
import type { RegistrationEmailChallenge, RegistrationEmailClient, RegistrationEmailProof } from "./types";

export function useRegistrationEmail(client: RegistrationEmailClient) {
  const [email, setEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<RegistrationEmailChallenge | null>(null);
  const [proof, setProof] = useState<RegistrationEmailProof | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const serial = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearInterval(timer); serial.current++; pending.current?.abort(); };
  }, []);
  useEffect(() => {
    if (proof && Date.parse(proof.expires_at) <= now) {
      setProof(null);
      setChallenge(null);
      setCode("");
      setMessage("Email verification expired. Verify again to keep completing your form.");
    }
  }, [now, proof]);

  function reverify() {
    if (completed) return;
    serial.current++;
    pending.current?.abort();
    setBusy(false);
    setProof(null);
    setChallenge(null);
    setCode("");
    setMessage("");
    setError(false);
  }

  function complete() {
    serial.current++;
    pending.current?.abort();
    setBusy(false);
    setProof(null);
    setChallenge(null);
    setCode("");
    setMessage("");
    setCompleted(true);
  }

  async function perform(verify: boolean) {
    if (busy || retryAt > Date.now()) return;
    if (!verify && challenge && Date.parse(challenge.resend_available_at) > Date.now()) return;
    if (verify && (!challenge || Date.parse(challenge.expires_at) <= Date.now() || !/^[0-9]{6}$/.test(code))) return;
    const current = ++serial.current;
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const normalized = email.trim().toLowerCase();
    setBusy(true);
    setError(false);
    setMessage("");
    let failed = false;
    try {
      if (verify && challenge) {
        const result = await client.verifyCode(normalized, challenge.challenge_id, code, controller.signal);
        if (current !== serial.current || controller.signal.aborted) return;
        if (!/^[a-f0-9]{64}$/.test(result.email_verification_token) || !Number.isFinite(Date.parse(result.expires_at))) throw new Error("Unexpected verification response. Try again.");
        setVerifiedEmail(normalized);
        setProof(result);
        setStarted(true);
        setCode("");
        setMessage("Email verified. Complete your registration below.");
      } else {
        const result = await client.requestCode(normalized, controller.signal);
        if (current !== serial.current || controller.signal.aborted) return;
        if (!result.challenge_id || !Number.isFinite(Date.parse(result.expires_at)) || !Number.isFinite(Date.parse(result.resend_available_at))) throw new Error("Unexpected code response. Try again.");
        setEmail(normalized);
        setChallenge(result);
        setCode("");
        setMessage("Check your inbox and spam folder for the latest code.");
      }
    } catch (caught) {
      if (current !== serial.current) return;
      failed = true;
      const failure = caught as { message?: string; status?: number; errors?: Record<string, string[]>; retryAfter?: number };
      setError(true);
      setMessage(controller.signal.aborted ? "The request timed out. Try again explicitly; a code may already have been sent."
        : failure.errors?.verification_code?.[0] ?? failure.errors?.email?.[0] ?? failure.message ?? "Unable to reach the service. Try again.");
      if (failure.status === 429) setRetryAt(Date.now() + Math.max(1, failure.retryAfter || 1) * 1000);
      else if (controller.signal.aborted || !failure.status || failure.status >= 500) setRetryAt(Date.now() + 60000);
    } finally {
      window.clearTimeout(timeout);
      if (current === serial.current) {
        setBusy(false);
        window.setTimeout(() => {
          if (current !== serial.current) return;
          if (!verify && !failed) codeInput.current?.focus();
          else feedback.current?.focus();
        }, 0);
      }
    }
  }

  const resendAt = Math.max(retryAt, challenge ? Date.parse(challenge.resend_available_at) : 0);
  return { email, setEmail, verifiedEmail, code, setCode, challenge, proof, busy, message, error,
    feedback, codeInput, started, completed, reverify, complete, perform, coolingDown: retryAt > now,
    resendSeconds: Math.max(0, Math.ceil((resendAt - now) / 1000)),
    expired: !!challenge && Date.parse(challenge.expires_at) <= now };
}
