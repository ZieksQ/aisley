"use client";

import { Button, TextField } from "@aisley/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { FiArrowRight, FiMail } from "react-icons/fi";
import { ApiError, firstFieldError } from "@/lib/api";
import { loginCustomer } from "@/lib/customer-auth";
import { useAuth } from "@/components/auth/auth-provider";
import { FormAlert } from "./form-alert";
import { PasswordField } from "./password-field";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const { setAuthenticatedCustomer } = useAuth();
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);

    try {
      const { customer } = await loginCustomer({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        remember: form.get("remember") === "on",
      });
      setAuthenticatedCustomer(customer);
      router.replace(returnTo);
      router.refresh();
    } catch (caught) {
      const apiError =
        caught instanceof ApiError
          ? caught
          : new ApiError(0, { message: "Something went wrong. Please try again." });

      if (apiError.code === "ACCOUNT_PENDING_APPROVAL") {
        router.push("/waiting-for-approval");
        return;
      }

      if (apiError.code === "ACCOUNT_REJECTED") {
        router.push("/account-not-approved");
        return;
      }

      setError(apiError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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

      <div>
        <PasswordField
          id="password"
          name="password"
          label="Password"
          placeholder="Enter your password"
          autoComplete="current-password"
          required
          disabled={submitting}
          error={firstFieldError(error, "password")}
        />
        <div className="mt-3 flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#5F5363]">
            <input
              type="checkbox"
              name="remember"
              disabled={submitting}
              className="size-4 rounded border-[#CFC6D2] accent-[#E6007A]"
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-[#4C1268] underline-offset-4 hover:text-[#E6007A] hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full"
        isLoading={submitting}
        loadingLabel="Signing in"
      >
        Sign in
        <FiArrowRight aria-hidden="true" />
      </Button>
    </form>
  );
}
