"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import type { RegistrationEmailClient, RegistrationNavigation, VerifiedRegistrationEmail } from "./types";
import { useRegistrationEmail } from "./use-registration-email";

export function RegistrationEmailGate({ client, children, navigation, showTitle = true, accent = "purple", role = "customer" }: {
  client: RegistrationEmailClient;
  children: (email: VerifiedRegistrationEmail) => ReactNode;
  navigation: RegistrationNavigation;
  showTitle?: boolean;
  accent?: "purple" | "blue";
  role?: "customer" | "seller" | "logistics";
}) {
  const { feedback, codeInput, ...state } = useRegistrationEmail(client, navigation);
  const id = useId();
  const heading = useRef<HTMLDivElement>(null);
  const previous = useRef(navigation.step);
  const recovering = useRef(false);
  const step = navigation.step;
  const hasVerification = !!state.challenge || !!state.proof;

  useEffect(() => {
    if (previous.current === "verify-email" && step === "details" && !state.completed && ((!state.proof && state.challenge) || state.submitting)) {
      state.leaveVerification();
    }
    previous.current = step;
    if (step === "verify-email") codeInput.current?.focus();
    else heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  useEffect(() => {
    if (state.completed && step !== "success") {
      navigation.navigate("success", true);
      return;
    }
    if ((step === "success" && !state.completed) ||
      (step === "verify-email" && !hasVerification && !state.submitting)) {
      if (recovering.current) return;
      recovering.current = true;
      state.leaveVerification();
      navigation.navigate("details", true);
    } else recovering.current = false;
  }, [step, hasVerification, state.completed, state.submitting, navigation]);

  const inputClass = "mt-2 min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-100";
  const buttonClass = "inline-flex min-h-12 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold disabled:opacity-50 transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2";
  const primary = accent === "blue" ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]" : "bg-[#4C1268] text-white hover:bg-[#3D0E54]";
  const title = step === "success" ? "Account created successfully" : step === "verify-email" ? "Verify your email" : null;

  return (
    <div ref={heading} tabIndex={-1} className="space-y-6 text-zinc-900 focus:outline-none dark:text-zinc-100">
      {showTitle && title && <h2 className="text-2xl font-semibold tracking-tight focus:outline-none">{title}</h2>}
      {/* Keep the form mounted so native file inputs and unsaved details survive Back. */}
      {!state.completed && <div hidden={step !== "details"} aria-busy={state.submitting}>
        <fieldset disabled={state.busy || state.submitting || step !== "details"}>
          {children({ ready: state.required === false || !!state.proof, email: state.email,
            token: state.proof?.email_verification_token ?? "", submitting: state.submitting,
            beginSubmission: () => state.beginSubmission(),
            setEmail: (email) => {
              if (state.submitting || state.completed) return;
              if (email.trim().toLowerCase() !== state.email.trim().toLowerCase()) state.reverify();
              state.setEmail(email);
            },
            continueToVerification: state.continueToVerification,
          })}
        </fieldset>
      </div>}
      {state.configLoading && step === "details" && <p role="status" className="text-sm">Loading registration settings…</p>}
      {state.required === null && !state.configLoading && step === "details" && <button type="button" className={`${buttonClass} ${primary}`} onClick={() => void state.loadConfig()}>Retry registration settings</button>}
      {state.message && step !== "success" && !state.submitting && (step === "details" || state.error) && <p ref={feedback} tabIndex={-1} role={state.error ? "alert" : "status"}
        className={`text-sm leading-6 focus:outline-none ${state.error ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-300"}`}>{state.message}</p>}
      {step === "verify-email" && hasVerification && !state.submitting && (
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void state.perform(true); }}>
          <p className="break-words text-base leading-6">Enter the code sent to <strong>{state.email}</strong>. Check your spam folder too.</p>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">Verifying your email will automatically submit your registration.</p>
          <label className="block text-sm font-medium" htmlFor={`${id}-code`}>Verification code
            <input ref={codeInput} id={`${id}-code`} name="verification_code" autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
              required maxLength={6} className={inputClass} value={state.code} disabled={state.busy}
              onChange={(event) => state.setCode(event.target.value.replace(/\D/g, ""))} />
          </label>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{state.expired ? "This code expired. Request a new one." : "Use the latest code. It expires ten minutes after your request."}</p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={`${buttonClass} ${primary}`} disabled={state.busy || state.coolingDown || state.expired}>
              {state.busy ? "Verifying…" : "Verify email"}
            </button>
            <button type="button" className={`${buttonClass} border border-zinc-300 dark:border-white/20`} disabled={state.busy || state.resendSeconds > 0}
              onClick={() => void state.perform(false)}>{state.resendSeconds ? `Resend in ${state.resendSeconds}s` : "Resend code"}</button>
            <button type="button" className={buttonClass} disabled={state.busy} onClick={state.reverify}>Back to edit details</button>
          </div>
          {state.coolingDown && <p role="status" className="text-sm">Please wait {state.resendSeconds}s before trying again.</p>}
        </form>
      )}
      {state.submitting && <p role="status" className="text-base leading-6" aria-live="polite">Creating your account… Please wait.</p>}
      {step === "success" && state.completed && <div className="space-y-5">
        <p role="status" className="text-base leading-7">{state.outcome === "active"
          ? "Your account is ready. You can now sign in."
          : `Your registration was submitted successfully. Please wait for Admin approval before signing in${role === "seller" ? " to your Seller account and Shop" : ""}. We’ll email you once your application has been reviewed.`}</p>
        <div className="flex flex-wrap gap-3">
          <a href="/login" className={`${buttonClass} ${primary}`}>Go to sign in</a>
          {role === "customer" && <a href="/" className={`${buttonClass} border border-zinc-300 dark:border-white/20`}>Continue shopping</a>}
        </div>
      </div>}
    </div>
  );
}
