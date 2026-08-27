"use client";

import { Button, TextField } from "@aisley/ui";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { FiArrowRight, FiMail } from "react-icons/fi";
import { ApiError, firstFieldError } from "@/lib/api";
import { resetCustomerPassword } from "@/lib/customer-auth";
import { FormAlert } from "./form-alert";
import { PasswordField } from "./password-field";

export function ResetPasswordForm({
  initialEmail,
  token,
}: {
  initialEmail: string;
  token: string;
}) {
  const [error, setError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      await resetCustomerPassword({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        password_confirmation: String(form.get("password_confirmation") ?? ""),
        token,
      });
      setSuccess(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, { message: "Something went wrong. Please try again." }),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="mt-8 space-y-5">
        <FormAlert>
          This reset link is incomplete or invalid. Request a new link to continue.
        </FormAlert>
        <Link
          href="/forgot-password"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#E6007A] px-5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(230,0,122,0.2)] transition hover:bg-[#C9006B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E6007A]/25"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mt-8 space-y-5">
        <FormAlert tone="success">
          Your password has been reset. You can now sign in with your new password.
        </FormAlert>
        <Link
          href="/login"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#E6007A] px-5 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(230,0,122,0.2)] transition hover:bg-[#C9006B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E6007A]/25"
        >
          Continue to sign in
          <FiArrowRight aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      {error ? <FormAlert>{error.message}</FormAlert> : null}

      <TextField
        id="email"
        name="email"
        type="email"
        label="Email address"
        defaultValue={initialEmail}
        placeholder="you@example.com"
        autoComplete="email"
        inputMode="email"
        required
        disabled={submitting}
        error={firstFieldError(error, "email")}
        leadingIcon={<FiMail className="size-[18px]" />}
      />
      <PasswordField
        id="password"
        name="password"
        label="New password"
        placeholder="Create a new password"
        autoComplete="new-password"
        required
        minLength={8}
        disabled={submitting}
        hint="Use 8+ characters with uppercase, lowercase, and a number."
        error={firstFieldError(error, "password")}
      />
      <PasswordField
        id="password_confirmation"
        name="password_confirmation"
        label="Confirm new password"
        placeholder="Repeat your new password"
        autoComplete="new-password"
        required
        minLength={8}
        disabled={submitting}
        error={firstFieldError(error, "password_confirmation")}
      />

      <Button
        type="submit"
        className="w-full"
        isLoading={submitting}
        loadingLabel="Resetting password"
      >
        Reset password
        <FiArrowRight aria-hidden="true" />
      </Button>
    </form>
  );
}
