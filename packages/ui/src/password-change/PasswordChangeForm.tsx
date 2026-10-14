"use client";

import { useId } from "react";
import type { PasswordChangeProps, PasswordDraft } from "./types";
import { usePasswordChange } from "./use-password-change";

export function PasswordChangeForm(props: PasswordChangeProps) {
  const state = usePasswordChange(props);
  const id = useId();
  const inputClass = "mt-1 block min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 disabled:opacity-60 dark:border-white/20 dark:bg-zinc-900 dark:text-zinc-100";
  const primaryClass = props.accent === "blue"
    ? "bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
    : "bg-[#4C1268] text-white hover:bg-[#3D0E54]";
  const buttonClass = "min-h-11 rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-white/20";

  function field(name: keyof PasswordDraft, label: string, autoComplete: string) {
    const error = state.errors[name]?.[0];
    return (
      <div>
        <label className="text-sm font-medium" htmlFor={`${id}-${name}`}>
          {label}
        </label>
        <input
          id={`${id}-${name}`}
          name={name}
          type="password"
          autoComplete={autoComplete}
          required
          minLength={name === "current_password" ? undefined : 8}
          className={inputClass}
          value={state.draft[name]}
          disabled={state.busy || !!state.challenge || state.uncertain}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-${name}-error` : undefined}
          onChange={(event) => state.setDraft({ ...state.draft, [name]: event.target.value })}
        />
        {error && (
          <p id={`${id}-${name}-error`} className="mt-1 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-4 text-zinc-900 dark:text-zinc-100"
      onSubmit={(event) => {
        event.preventDefault();
        void state.perform(!!state.challenge);
      }}
    >
      <h3 className="text-base font-semibold">Password</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Confirm this change with a code sent to your account email. {props.sessionDescription}
      </p>
      {state.message && (
        <div ref={state.feedback} tabIndex={-1} role="status" className="text-sm">
          {state.message}
        </div>
      )}
      {!state.uncertain && (
        <>
          {field("current_password", "Current password", "current-password")}
          {field("password", "New password", "new-password")}
          {field("password_confirmation", "Confirm new password", "new-password")}
          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            Use at least 8 characters with uppercase, lowercase, and a number.
          </p>
        </>
      )}
      {state.challenge && (
        <div className="space-y-3">
          <p className="text-sm">
            Enter the latest code emailed to {state.challenge.masked_email}.{" "}
            {state.expired
              ? "This code has expired. Request a new one."
              : "The code expires ten minutes after your request."}
          </p>
          <label className="block text-sm font-medium" htmlFor={`${id}-code`}>
            Verification code
            <input
              id={`${id}-code`}
              name="verification_code"
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              className={inputClass}
              value={state.code}
              disabled={state.busy}
              aria-invalid={!!state.errors.verification_code}
              aria-describedby={state.errors.verification_code ? `${id}-code-error` : undefined}
              onChange={(event) => state.setCode(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          {state.errors.verification_code && (
            <p id={`${id}-code-error`} role="alert" className="text-sm text-red-700 dark:text-red-300">
              {state.errors.verification_code[0]}
            </p>
          )}
          {state.errors.challenge_id && (
            <p role="alert" className="text-sm">{state.errors.challenge_id[0]}</p>
          )}
          <button
            type="button"
            className={buttonClass}
            disabled={state.busy || state.remaining > 0}
            onClick={() => void state.perform(false)}
          >
            {state.remaining > 0 ? `Resend in ${state.remaining}s` : "Resend code"}
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className={`${buttonClass} ${primaryClass}`}
          disabled={state.busy || state.uncertain || state.coolingDown || state.expired || (!state.challenge && state.remaining > 0)}
        >
          {state.busy
            ? "Please wait…"
            : state.challenge
              ? "Verify and update password"
              : state.remaining > 0
                ? `Request code in ${state.remaining}s`
                : "Send verification code"}
        </button>
        <button type="button" className={buttonClass} disabled={state.busy} onClick={state.cancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
