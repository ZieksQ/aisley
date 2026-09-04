"use client";

import { Button, SelectField, TextField } from "@aisley/ui";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FiCheckCircle, FiLock, FiRefreshCw } from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";
import { ProfilePhotoSection } from "@/components/account/profile-photo-section";
import {
  fetchCustomerAccount,
  updateCustomerPassword,
  updateCustomerProfile,
} from "@/lib/account/client";
import type {
  CustomerAccount,
  CustomerPasswordPayload,
  CustomerProfileMutationResponse,
  CustomerProfilePayload,
} from "@/lib/account/types";
import { ApiError, firstFieldError } from "@/lib/api";

const emptyProfile: CustomerProfilePayload = {
  first_name: "",
  middle_name: null,
  last_name: "",
  contact_number: "",
  sex: "",
  birth_date: "",
};

const emptyPasswords: CustomerPasswordPayload = {
  current_password: "",
  password: "",
  password_confirmation: "",
};

type Feedback = {
  error: ApiError | null;
  message: string | null;
};

const emptyFeedback: Feedback = { error: null, message: null };

function profileForm(account: CustomerAccount): CustomerProfilePayload {
  return {
    first_name: account.profile.firstName,
    middle_name: account.profile.middleName,
    last_name: account.profile.lastName,
    contact_number: account.profile.contactNumber,
    sex: account.profile.sex,
    birth_date: account.profile.birthDate,
  };
}

function ageFor(birthDate: string) {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDifference = today.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function toApiError(caught: unknown, fallback: string) {
  return caught instanceof ApiError
    ? caught
    : new ApiError(0, { message: caught instanceof Error ? caught.message : fallback });
}

export function CustomerAccountContent() {
  const { setAuthenticatedCustomer } = useAuth();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [profile, setProfile] = useState<CustomerProfilePayload>(emptyProfile);
  const [passwords, setPasswords] = useState<CustomerPasswordPayload>(emptyPasswords);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<"profile" | "password" | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(emptyFeedback);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(emptyFeedback);
  const profileFeedbackRef = useRef<HTMLDivElement>(null);
  const passwordFeedbackRef = useRef<HTMLDivElement>(null);
  const displayedAge = useMemo(() => ageFor(profile.birth_date), [profile.birth_date]);

  useEffect(() => {
    const controller = new AbortController();

    fetchCustomerAccount(controller.signal)
      .then(({ account: nextAccount }) => {
        setAccount(nextAccount);
        setProfile(profileForm(nextAccount));
        setStatus("ready");
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setLoadError(toApiError(caught, "We could not load your account.").message);
        setStatus("error");
      });

    return () => controller.abort();
  }, [reloadKey]);

  function focusFeedback(ref: typeof profileFeedbackRef) {
    window.requestAnimationFrame(() => ref.current?.focus());
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("profile");
    setProfileFeedback(emptyFeedback);

    try {
      const response = await updateCustomerProfile(profile);
      setAccount(response.account);
      setProfile(profileForm(response.account));
      setAuthenticatedCustomer(response.customer);
      setProfileFeedback({ error: null, message: response.message });
    } catch (caught) {
      setProfileFeedback({
        error: toApiError(caught, "We could not save your profile."),
        message: null,
      });
    } finally {
      setBusy(null);
      focusFeedback(profileFeedbackRef);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("password");
    setPasswordFeedback(emptyFeedback);

    try {
      const response = await updateCustomerPassword(passwords);
      setPasswords(emptyPasswords);
      setPasswordFeedback({ error: null, message: response.message });
    } catch (caught) {
      setPasswordFeedback({
        error: toApiError(caught, "We could not update your password."),
        message: null,
      });
    } finally {
      setBusy(null);
      focusFeedback(passwordFeedbackRef);
    }
  }

  function applyPhotoUpdate(response: CustomerProfileMutationResponse) {
    setAccount(response.account);
    setAuthenticatedCustomer(response.customer);
  }

  if (status === "loading") {
    return (
      <div aria-label="Loading account settings" className="space-y-4">
        <div className="h-24 animate-pulse border border-[#E2DCE4] bg-[#F3EFF4]" />
        <div className="h-96 animate-pulse border border-[#E2DCE4] bg-[#F3EFF4]" />
      </div>
    );
  }

  if (status === "error" || !account) {
    return (
      <section className="border border-[#E2DCE4] bg-white p-5">
        <p role="alert" className="text-sm text-[#B42318]">{loadError || "Account settings are unavailable."}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-4 min-h-10 rounded-md px-4"
          onClick={() => {
            setStatus("loading");
            setLoadError("");
            setReloadKey((value) => value + 1);
          }}
        >
          <FiRefreshCw aria-hidden="true" /> Try again
        </Button>
      </section>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#281E2C]">Profile and security</h1>
      <p className="mt-1 text-sm leading-6 text-[#675B6B]">
        Update the personal details used for your customer account and orders.
      </p>

      <ProfilePhotoSection account={account} onUpdated={applyPhotoUpdate} />

      <section aria-labelledby="account-identity-heading" className="mt-5 border border-[#DED7E1] bg-white p-5 sm:p-6">
        <h2 id="account-identity-heading" className="text-base font-semibold text-[#302534]">Account identity</h2>
        <dl className="mt-4 grid gap-4 border-t border-[#E9E4EB] pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-[#746978]">Email address</dt>
            <dd className="mt-1 break-all text-sm font-semibold text-[#302534]">{account.email}</dd>
            <p className="mt-1 text-xs leading-5 text-[#746978]">Email changes are not available yet.</p>
          </div>
          <div>
            <dt className="text-xs font-medium text-[#746978]">Account status</dt>
            <dd className="mt-1 text-sm font-semibold text-[#3F6846]">Active customer</dd>
          </div>
        </dl>
      </section>

      <form onSubmit={saveProfile} className="mt-5 border border-[#DED7E1] bg-white p-5 sm:p-6" noValidate>
        <div>
          <h2 className="text-base font-semibold text-[#302534]">Profile information</h2>
          <p className="mt-1 text-sm leading-6 text-[#746978]">Fields marked with an asterisk (*) are required.</p>
        </div>

        {profileFeedback.error || profileFeedback.message ? (
          <div
            ref={profileFeedbackRef}
            tabIndex={-1}
            role={profileFeedback.error ? "alert" : "status"}
            className={`mt-4 flex items-start gap-2 border-l-2 px-3 py-2 text-sm outline-none ${profileFeedback.error ? "border-[#B42318] bg-[#FFF4F2] text-[#9A271E]" : "border-[#3F6846] bg-[#F3F8F4] text-[#315637]"}`}
          >
            {!profileFeedback.error ? <FiCheckCircle aria-hidden="true" className="mt-0.5 shrink-0" /> : null}
            <span>{profileFeedback.error?.message ?? profileFeedback.message}</span>
          </div>
        ) : null}

        <fieldset disabled={busy !== null} className="mt-5 grid gap-5 sm:grid-cols-2">
          <TextField
            id="first_name"
            label="First name *"
            name="first_name"
            autoComplete="given-name"
            required
            value={profile.first_name}
            error={firstFieldError(profileFeedback.error, "first_name")}
            onChange={(event) => setProfile((current) => ({ ...current, first_name: event.target.value }))}
          />
          <TextField
            id="last_name"
            label="Last name *"
            name="last_name"
            autoComplete="family-name"
            required
            value={profile.last_name}
            error={firstFieldError(profileFeedback.error, "last_name")}
            onChange={(event) => setProfile((current) => ({ ...current, last_name: event.target.value }))}
          />
          <TextField
            id="middle_name"
            label="Middle name"
            name="middle_name"
            autoComplete="additional-name"
            value={profile.middle_name ?? ""}
            error={firstFieldError(profileFeedback.error, "middle_name")}
            onChange={(event) => setProfile((current) => ({ ...current, middle_name: event.target.value || null }))}
          />
          <TextField
            id="contact_number"
            label="Contact number *"
            name="contact_number"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={profile.contact_number}
            error={firstFieldError(profileFeedback.error, "contact_number")}
            onChange={(event) => setProfile((current) => ({ ...current, contact_number: event.target.value }))}
          />
          <TextField
            id="birth_date"
            label="Birth date *"
            name="birth_date"
            type="date"
            autoComplete="bday"
            required
            value={profile.birth_date}
            error={firstFieldError(profileFeedback.error, "birth_date")}
            hint={displayedAge === null ? undefined : `Age: ${displayedAge}`}
            onChange={(event) => setProfile((current) => ({ ...current, birth_date: event.target.value }))}
          />
          <SelectField
            id="sex"
            label="Sex *"
            name="sex"
            required
            value={profile.sex}
            error={firstFieldError(profileFeedback.error, "sex")}
            onChange={(event) => setProfile((current) => ({ ...current, sex: event.target.value as CustomerProfilePayload["sex"] }))}
          >
            <option value="" disabled>Select an option</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="non_binary">Non-binary</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </SelectField>
        </fieldset>

        <div className="mt-6 flex justify-end border-t border-[#E9E4EB] pt-5">
          <Button
            type="submit"
            className="min-h-10 rounded-md px-5"
            isLoading={busy === "profile"}
            loadingLabel="Saving profile"
            disabled={busy !== null}
          >
            Save profile
          </Button>
        </div>
      </form>

      <form onSubmit={savePassword} className="mt-5 border border-[#DED7E1] bg-white p-5 sm:p-6" noValidate>
        <div className="flex items-start gap-3">
          <FiLock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#4C1268]" />
          <div>
            <h2 className="text-base font-semibold text-[#302534]">Password</h2>
            <p className="mt-1 text-sm leading-6 text-[#746978]">
              Use at least 8 characters with uppercase, lowercase, and a number. Changing it revokes other app access tokens while keeping this browser signed in.
            </p>
          </div>
        </div>

        {passwordFeedback.error || passwordFeedback.message ? (
          <div
            ref={passwordFeedbackRef}
            tabIndex={-1}
            role={passwordFeedback.error ? "alert" : "status"}
            className={`mt-4 flex items-start gap-2 border-l-2 px-3 py-2 text-sm outline-none ${passwordFeedback.error ? "border-[#B42318] bg-[#FFF4F2] text-[#9A271E]" : "border-[#3F6846] bg-[#F3F8F4] text-[#315637]"}`}
          >
            {!passwordFeedback.error ? <FiCheckCircle aria-hidden="true" className="mt-0.5 shrink-0" /> : null}
            <span>{passwordFeedback.error?.message ?? passwordFeedback.message}</span>
          </div>
        ) : null}

        <fieldset disabled={busy !== null} className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2 sm:w-1/2 sm:pr-2.5">
            <TextField
              id="current_password"
              label="Current password *"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
              value={passwords.current_password}
              error={firstFieldError(passwordFeedback.error, "current_password")}
              onChange={(event) => setPasswords((current) => ({ ...current, current_password: event.target.value }))}
            />
          </div>
          <TextField
            id="password"
            label="New password *"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={passwords.password}
            error={firstFieldError(passwordFeedback.error, "password")}
            onChange={(event) => setPasswords((current) => ({ ...current, password: event.target.value }))}
          />
          <TextField
            id="password_confirmation"
            label="Confirm new password *"
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={passwords.password_confirmation}
            error={firstFieldError(passwordFeedback.error, "password_confirmation")}
            onChange={(event) => setPasswords((current) => ({ ...current, password_confirmation: event.target.value }))}
          />
        </fieldset>

        <div className="mt-6 flex justify-end border-t border-[#E9E4EB] pt-5">
          <Button
            type="submit"
            variant="secondary"
            className="min-h-10 rounded-md px-5"
            isLoading={busy === "password"}
            loadingLabel="Updating password"
            disabled={busy !== null}
          >
            Update password
          </Button>
        </div>
      </form>
    </div>
  );
}
