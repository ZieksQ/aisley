"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import type { RegistrationEmailClient, VerifiedRegistrationEmail } from "./types";
import { useRegistrationEmail } from "./use-registration-email";

export function RegistrationEmailGate({ client, children, accent = "purple" }: {
  client: RegistrationEmailClient;
  children: (email: VerifiedRegistrationEmail) => ReactNode;
  accent?: "purple" | "blue";
}) {
  const state = useRegistrationEmail(client);
  const id = useId();
  const inputClass = "mt-2 min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-100";
  const buttonClass = "min-h-12 rounded-lg px-5 py-3 text-sm font-semibold disabled:opacity-50 transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2";
  const primary = accent === "blue" ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]" : "bg-[#4C1268] text-white hover:bg-[#3D0E54]";
  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100">
      {!state.completed && <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{state.proof ? "Your email is verified" : "Verify your email"}</h2>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {state.proof ? state.verifiedEmail : "First, confirm your email with a six-digit code. Your application will still need approval."}
        </p>
      </div>}
      {state.message && <p ref={state.feedback} tabIndex={-1} role={state.error ? "alert" : "status"}
        className={`text-sm leading-6 focus:outline-none ${state.error ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-300"}`}>{state.message}</p>}
      {state.proof ? (
        <button type="button" className={`${buttonClass} border border-zinc-300 dark:border-white/20`} onClick={state.reverify}>Change email</button>
      ) : !state.completed && (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void state.perform(!!state.challenge); }}>
          <label className="block text-sm font-medium" htmlFor={`${id}-email`}>Email address
            <input id={`${id}-email`} name="email" type="email" autoComplete="email" maxLength={255} required className={inputClass}
              disabled={state.busy || !!state.challenge} value={state.email} onChange={(event) => state.setEmail(event.target.value)} />
          </label>
          {state.challenge && <>
            <label className="block text-sm font-medium" htmlFor={`${id}-code`}>Verification code
              <input ref={state.codeInput} id={`${id}-code`} name="verification_code" autoFocus type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
                required maxLength={6} className={`${inputClass} tracking-[0.3em]`} value={state.code} disabled={state.busy}
                onChange={(event) => state.setCode(event.target.value.replace(/\D/g, ""))} />
            </label>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">{state.expired ? "This code expired. Request a new one." : "Use the latest code. It expires ten minutes after your request."}</p>
          </>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={`${buttonClass} ${primary}`} disabled={state.busy || state.coolingDown || state.expired}>
              {state.busy ? "Please wait…" : state.challenge ? "Verify email" : "Send verification code"}
            </button>
            {state.challenge && <>
              <button type="button" className={`${buttonClass} border border-zinc-300 dark:border-white/20`} disabled={state.busy || state.resendSeconds > 0}
                onClick={() => void state.perform(false)}>{state.resendSeconds ? `Resend in ${state.resendSeconds}s` : "Resend code"}</button>
              <button type="button" className={buttonClass} onClick={state.reverify}>Change email</button>
            </>}
          </div>
          {state.coolingDown && <p role="status" className="text-sm">Please wait {state.resendSeconds}s before trying again.</p>}
        </form>
      )}
      {state.started && <div hidden={!state.proof && !state.completed}>
        <fieldset disabled={!state.proof || state.busy}>
          {children({ email: state.verifiedEmail, token: state.proof?.email_verification_token ?? "", reverify: state.reverify, complete: state.complete })}
        </fieldset>
      </div>}
    </div>
  );
}
