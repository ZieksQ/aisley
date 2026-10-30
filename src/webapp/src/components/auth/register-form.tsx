"use client";

import { RegistrationEmailGate, type VerifiedRegistrationEmail } from "@aisley/ui/registration-email";
import { registrationEmailClient } from "@/lib/registration-email";
import { Button, SelectField, TextField } from "@aisley/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  FiArrowRight,
  FiCalendar,
  FiMail,
  FiPhone,
  FiUser,
} from "react-icons/fi";
import { ApiError, firstFieldError } from "@/lib/api";
import { registerCustomer } from "@/lib/customer-auth";
import { FormAlert } from "./form-alert";
import { PasswordField } from "./password-field";

function value(form: FormData, field: string) {
  return String(form.get(field) ?? "");
}

export function RegisterForm() {
  return <RegistrationEmailGate client={registrationEmailClient}>{(verification) => <RegistrationDetails verification={verification} />}</RegistrationEmailGate>;
}

function RegistrationDetails({ verification }: { verification: VerifiedRegistrationEmail }) {
  const router = useRouter();
  const [error, setError] = useState<ApiError | null>(null);
  const submitting = verification.submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    if (verification.continueToVerification()) return
    const attempt = verification.beginSubmission();
    if (!attempt) return;
    setError(null);

    try {
      const { customer } = await registerCustomer({
        birth_date: value(form, "birth_date"),
        contact_number: value(form, "contact_number"),
        email: attempt.email,
        email_verification_token: attempt.token,
        first_name: value(form, "first_name"),
        last_name: value(form, "last_name"),
        middle_name: value(form, "middle_name") || undefined,
        password: value(form, "password"),
        password_confirmation: value(form, "password_confirmation"),
        sex: value(form, "sex"),
      }, attempt.signal);
      if (attempt.complete()) router.push(customer.status === "active" ? "/login?registered=1" : "/waiting-for-approval?registered=1");
    } catch (caught) {
      if (!attempt.isCurrent()) return;
      const failure = caught instanceof ApiError && caught.status > 0 && caught.status < 500 && caught.status !== 408
        ? caught
        : new ApiError(0, { message: "The registration result is unconfirmed. Try signing in before deliberately submitting again; your application may already be pending." });
      setError(failure);
      attempt.finish({ reverify: !!failure.errors.email_verification_token, message: failure.message });
      window.scrollTo({ behavior: "smooth", top: 0 });
    } finally {
      attempt.finish();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      {error ? <FormAlert>{error.message}</FormAlert> : null}

      <fieldset disabled={submitting} className="space-y-6">
        <legend className="sr-only">Customer details</legend>

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="first_name"
            name="first_name"
            label="First name"
            placeholder="Aisley"
            autoComplete="given-name"
            required
            error={firstFieldError(error, "first_name")}
            leadingIcon={<FiUser className="size-[18px]" />}
          />
          <TextField
            id="last_name"
            name="last_name"
            label="Last name"
            placeholder="Buyer"
            autoComplete="family-name"
            required
            error={firstFieldError(error, "last_name")}
            leadingIcon={<FiUser className="size-[18px]" />}
          />
        </div>

        <TextField
          id="middle_name"
          name="middle_name"
          label="Middle name (optional)"
          placeholder="Your middle name"
          autoComplete="additional-name"
          error={firstFieldError(error, "middle_name")}
          leadingIcon={<FiUser className="size-[18px]" />}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="contact_number"
            name="contact_number"
            type="tel"
            label="Contact number"
            placeholder="+63 917 123 4567"
            autoComplete="tel"
            inputMode="tel"
            required
            error={firstFieldError(error, "contact_number")}
            leadingIcon={<FiPhone className="size-[18px]" />}
          />
          <TextField
            id="birth_date"
            name="birth_date"
            type="date"
            label="Birth date"
            autoComplete="bday"
            required
            error={firstFieldError(error, "birth_date")}
            leadingIcon={<FiCalendar className="size-[18px]" />}
          />
        </div>

        <SelectField
          id="sex"
          name="sex"
          label="Sex"
          defaultValue=""
          required
          error={firstFieldError(error, "sex")}
        >
          <option value="" disabled>
            Select an option
          </option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="non_binary">Non-binary</option>
          <option value="prefer_not_to_say">Prefer not to say</option>
        </SelectField>

        <TextField
          id="email"
          name="email"
          value={verification.email}
          onChange={(event) => verification.setEmail(event.target.value)}
          type="email"
          label="Email address"
          placeholder="you@example.com"
          autoComplete="email"
          inputMode="email"
          required
          error={firstFieldError(error, "email")}
          leadingIcon={<FiMail className="size-[18px]" />}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <PasswordField
            id="password"
            name="password"
            label="Password"
            placeholder="Create a password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="Use 8+ characters with uppercase, lowercase, and a number."
            error={firstFieldError(error, "password")}
          />
          <PasswordField
            id="password_confirmation"
            name="password_confirmation"
            label="Confirm password"
            placeholder="Repeat your password"
            autoComplete="new-password"
            required
            minLength={8}
            error={firstFieldError(error, "password_confirmation")}
          />
        </div>

      </fieldset>

      <Button
        type="submit"
        className="w-full"
        isLoading={submitting}
        loadingLabel="Creating account"
      >
        {verification.ready ? "Submit registration" : "Continue to email verification"}
        <FiArrowRight aria-hidden="true" />
      </Button>
    </form>
  );
}
