"use client";

import { useEffect, useRef, useState } from "react";
import type { RegistrationEmailChallenge, RegistrationEmailClient, RegistrationEmailProof, RegistrationSubmission } from "./types";

export function useRegistrationEmail(client: RegistrationEmailClient) {
  const [email, setEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<RegistrationEmailChallenge | null>(null);
  const [proof, setProof] = useState<RegistrationEmailProof | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const serial = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const registration = useRef<AbortController | null>(null);
  const verified = useRef<{ proof: RegistrationEmailProof; generation: number } | null>(null);
  const mounted = useRef(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      serial.current++;
      pending.current?.abort();
      registration.current?.abort();
      registration.current = null;
    };
  }, []);
  useEffect(() => {
    if (proof && Date.parse(proof.expires_at) <= now && !registration.current) {
      serial.current++;
      verified.current = null;
      setProof(null);
      setChallenge(null);
      setCode("");
      setMessage("Email verification expired. Verify again to keep completing your form.");
    }
  }, [now, proof, submitting]);

  function resetVerification(message = "") {
    serial.current++;
    pending.current?.abort();
    verified.current = null;
    setBusy(false);
    setProof(null);
    setChallenge(null);
    setCode("");
    setMessage(message);
    setError(false);
  }

  function reverify() {
    if (!mounted.current || completed || registration.current) return;
    resetVerification();
  }

  function beginSubmission(): RegistrationSubmission | null {
    // The ref locks synchronously, including two submissions before React renders.
    if (!mounted.current || busy || completed || registration.current || !proof
      || verified.current?.proof !== proof || verified.current.generation !== serial.current) return null;
    if (Date.parse(proof.expires_at) <= Date.now()) {
      resetVerification("Email verification expired. Verify again to keep completing your form.");
      return null;
    }
    const generation = serial.current;
    const controller = new AbortController();
    registration.current = controller;
    setSubmitting(true);
    const isCurrent = () => mounted.current && serial.current === generation
      && registration.current === controller && !controller.signal.aborted;
    function release() {
      registration.current = null;
      controller.abort();
      setSubmitting(false);
    }
    return {
      email: verifiedEmail,
      token: proof.email_verification_token,
      signal: controller.signal,
      isCurrent,
      complete() {
        if (!isCurrent()) return false;
        release();
        resetVerification();
        setCompleted(true);
        return true;
      },
      finish(failure) {
        if (!isCurrent()) return;
        release();
        if (failure?.reverify || Date.parse(proof.expires_at) <= Date.now()) {
          const prompt = failure?.reverify ? "Verify your email again to continue your application."
            : "Email verification expired. Verify again to keep completing your form.";
          resetVerification([failure?.message, prompt].filter(Boolean).join(" "));
        }
      },
    };
  }

  async function perform(verify: boolean) {
    if (!mounted.current || completed || registration.current || busy || retryAt > Date.now()) return;
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
        verified.current = { proof: result, generation: current };
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
  return { email, setEmail, verifiedEmail, code, setCode, challenge, proof, busy, submitting, message, error,
    feedback, codeInput, started, completed, reverify, beginSubmission, perform, coolingDown: retryAt > now,
    resendSeconds: Math.max(0, Math.ceil((resendAt - now) / 1000)),
    expired: !!challenge && Date.parse(challenge.expires_at) <= now };
}
