"use client";

import { useEffect, useRef, useState } from "react";
import type { RegistrationEmailChallenge, RegistrationEmailClient, RegistrationEmailProof, RegistrationSubmission, RegistrationNavigation } from "./types";

export function useRegistrationEmail(client: RegistrationEmailClient, navigation?: RegistrationNavigation) {
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const automaticSubmission = useRef<((attempt: RegistrationSubmission) => Promise<void>) | null>(null);
  const operation = useRef(false);
  const [outcome, setOutcome] = useState<"active" | "pending">("pending");
  const [required, setRequired] = useState<boolean | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const configRequest = useRef<AbortController | null>(null);
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
  const verified = useRef<{ proof: RegistrationEmailProof; generation: number; email: string } | null>(null);
  const mounted = useRef(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    void loadConfig();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      mounted.current = false;
      configRequest.current?.abort();
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
      automaticSubmission.current = null;
      navigationRef.current?.navigate("details", true);
      setMessage("Email verification expired. Verify again to keep completing your form.");
    }
  }, [now, proof, submitting]);

  async function loadConfig() {
    configRequest.current?.abort();
    const controller = new AbortController();
    configRequest.current = controller;
    setConfigLoading(true);
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const config = await client.getConfig(controller.signal);
      if (!mounted.current || configRequest.current !== controller) return;
      if (typeof config.email_verification_required !== "boolean") throw new Error("Invalid configuration");
      setRequired(config.email_verification_required);
      setMessage("");
      setError(false);
    } catch {
      if (!mounted.current || configRequest.current !== controller) return;
      setRequired(null);
      setError(true);
      setMessage("Unable to load registration settings. Retry to continue.");
    } finally {
      window.clearTimeout(timeout);
      if (mounted.current && configRequest.current === controller) setConfigLoading(false);
    }
  }

  function resetVerification(message = "") {
    serial.current++;
    automaticSubmission.current = null;
    operation.current = false;
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
    navigationRef.current?.navigate("details");
  }

  function beginSubmission(fromVerification = false): RegistrationSubmission | null {
    // The ref locks synchronously, including two submissions before React renders.
    if (!mounted.current || (operation.current && !fromVerification) || completed || registration.current || required === null
      || (required && (!verified.current || verified.current.generation !== serial.current))) return null;
    const currentProof = required ? verified.current?.proof : undefined;
    if (currentProof && Date.parse(currentProof.expires_at) <= Date.now()) {
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
      email: required ? verified.current!.email : email.trim().toLowerCase(),
      token: currentProof?.email_verification_token ?? "",
      signal: controller.signal,
      isCurrent,
      complete(status = "pending") {
        if (!isCurrent()) return false;
        release();
        resetVerification();
        setOutcome(status);
        setCompleted(true);
        navigationRef.current?.navigate("success", true);
        return true;
      },
      finish(failure) {
        if (!isCurrent()) return;
        release();
        if (failure?.reverify || (currentProof && Date.parse(currentProof.expires_at) <= Date.now())) {
          const prompt = failure?.reverify ? "Verify your email again to continue your application."
            : "Email verification expired. Verify again to keep completing your form.";
          if (failure?.reverify) setRequired(true);
          resetVerification([failure?.message, prompt].filter(Boolean).join(" "));
        } else if (failure?.message) {
          setError(true);
          setMessage(failure.message);
        }
        navigationRef.current?.navigate("details", true);
      },
    };
  }

  async function perform(verify: boolean) {
    if (!mounted.current || completed || registration.current || operation.current || retryAt > Date.now()) return;
    if (!verify && challenge && Date.parse(challenge.resend_available_at) > Date.now()) return;
    if (verify && (!challenge || Date.parse(challenge.expires_at) <= Date.now() || !/^[0-9]{6}$/.test(code))) return;
    operation.current = true;
    const current = ++serial.current;
    const controller = new AbortController();
    pending.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const normalized = email.trim().toLowerCase();
    setBusy(true);
    setError(false);
    setMessage("");
    let failed = false;
    let verifiedNow = false;
    try {
      if (verify && challenge) {
        const result = await client.verifyCode(normalized, challenge.challenge_id, code, controller.signal);
        if (current !== serial.current || controller.signal.aborted) return;
        if (!/^[a-f0-9]{64}$/.test(result.email_verification_token) || !Number.isFinite(Date.parse(result.expires_at))) throw new Error("Unexpected verification response. Try again.");
        verified.current = { proof: result, generation: current, email: normalized };
        verifiedNow = true;
        setVerifiedEmail(normalized);
        setProof(result);
        setStarted(true);
        setCode("");
        setMessage("Email verified. Creating your account…");
      } else {
        const result = await client.requestCode(normalized, controller.signal);
        if (current !== serial.current || controller.signal.aborted) return;
        if (!result.challenge_id || !Number.isFinite(Date.parse(result.expires_at)) || !Number.isFinite(Date.parse(result.resend_available_at))) throw new Error("Unexpected code response. Try again.");
        setEmail(normalized);
        setChallenge(result);
        navigationRef.current?.navigate("verify-email");
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
        operation.current = false;
        setBusy(false);
        window.setTimeout(() => {
          if (current !== serial.current) return;
          if (!verify && !failed) codeInput.current?.focus();
          else feedback.current?.focus();
        }, 0);
      }
    }
    if (verifiedNow && current === serial.current && mounted.current) {
      // Consume the callback before dispatch: renders and OTP retries cannot replay registration.
      const submit = automaticSubmission.current;
      automaticSubmission.current = null;
      if (submit) {
        const attempt = beginSubmission(true);
        if (attempt) await submit(attempt);
      }
    }
  }

  function continueToVerification(submit: (attempt: RegistrationSubmission) => Promise<void>) {
    if (required === null || operation.current || registration.current || completed) return true;
    if (!required || verified.current) return false;
    automaticSubmission.current = submit;
    if (challenge) navigationRef.current?.navigate("verify-email");
    else void perform(false);
    return true;
  }

  function leaveVerification() {
    if (completed) return;
    const uncertain = !!registration.current;
    registration.current?.abort();
    registration.current = null;
    setSubmitting(false);
    resetVerification(uncertain
      ? "The registration result is unconfirmed. Try signing in before deliberately submitting again; your application may already be pending."
      : "Your details are preserved. Continue when you are ready.");
  }

  const resendAt = Math.max(retryAt, challenge ? Date.parse(challenge.resend_available_at) : 0);
  return { required, configLoading, loadConfig, email, setEmail, verifiedEmail, code, setCode, challenge, proof, busy, submitting, message, error,
    feedback, codeInput, started, completed, outcome, reverify, beginSubmission, continueToVerification, leaveVerification, perform, coolingDown: retryAt > now,
    resendSeconds: Math.max(0, Math.ceil((resendAt - now) / 1000)),
    expired: !!challenge && Date.parse(challenge.expires_at) <= now };
}
