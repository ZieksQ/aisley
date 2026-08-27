"use client";

import { Button, TextField } from "@aisley/ui";
import { type FormEvent, useState } from "react";
import { FiMail, FiSend } from "react-icons/fi";
import { ApiError, firstFieldError } from "@/lib/api";
import { requestPasswordReset } from "@/lib/customer-auth";
import { FormAlert } from "./form-alert";

export function ForgotPasswordForm() {
  const [error, setError] = useState<ApiError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const response = await requestPasswordReset(String(form.get("email") ?? ""));
      setMessage(response.message);
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

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      {message ? <FormAlert tone="success">{message}</FormAlert> : null}
      {error ? <FormAlert>{error.message}</FormAlert> : null}

      <TextField
        id="email"
        name="email"
        type="email"
        label="Email address"
        placeholder="you@example.com"
        autoComplete="email"
        inputMode="email"
        required
        disabled={submitting}
        error={firstFieldError(error, "email")}
        leadingIcon={<FiMail className="size-[18px]" />}
      />

      <Button
        type="submit"
        className="w-full"
        isLoading={submitting}
        loadingLabel="Sending instructions"
      >
        Send reset instructions
        <FiSend aria-hidden="true" />
      </Button>
    </form>
  );
}
