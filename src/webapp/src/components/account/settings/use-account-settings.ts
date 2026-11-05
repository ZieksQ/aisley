"use client";
import { useAccountLifetime } from "@aisley/ui/account-settings";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  fetchCustomerAccount,
  updateCustomerProfile
} from "@/lib/account/client";
import type {
  CustomerAccount,
  CustomerProfileMutationResponse,
  CustomerProfilePayload,
} from "@/lib/account/types";
import { ApiError } from "@/lib/api";
const emptyProfile: CustomerProfilePayload = {
  first_name: "",
  middle_name: null,
  last_name: "",
  contact_number: "",
  sex: "",
  birth_date: "",
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
export function useAccountSettings() {
  const isCurrent = useAccountLifetime();
  const { setAuthenticatedCustomer, passwordSession } = useAuth();
  const [account, setAccount] = useState<CustomerAccount | null>(null);
  const [profile, setProfile] = useState<CustomerProfilePayload>(emptyProfile);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<"profile" | "password" | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(emptyFeedback);
  const profileFeedbackRef = useRef<HTMLDivElement>(null);
  const displayedAge = useMemo(() => ageFor(profile.birth_date), [profile.birth_date]);
  useEffect(() => {
    const controller = new AbortController();
    fetchCustomerAccount(controller.signal)
      .then(({ account: nextAccount }) => {
        if (controller.signal.aborted || !isCurrent()) return;
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
  }, [reloadKey, isCurrent]);
  function focusFeedback(ref: typeof profileFeedbackRef) {
    window.requestAnimationFrame(() => ref.current?.focus());
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("profile");
    setProfileFeedback(emptyFeedback);
    try {
      const response = await updateCustomerProfile(profile);
      if (!isCurrent()) return;
      setAccount(response.account);
      setProfile(profileForm(response.account));
      setAuthenticatedCustomer(response.customer);
      setProfileFeedback({ error: null, message: response.message });
    } catch (caught) {
      if (!isCurrent()) return;
      setProfileFeedback({
        error: toApiError(caught, "We could not save your profile."),
        message: null,
      });
    } finally {
      setBusy(null);
      focusFeedback(profileFeedbackRef);
    }
  }
  function applyPhotoUpdate(response: CustomerProfileMutationResponse) {
    if (!isCurrent()) return;
    setAccount(response.account);
    setAuthenticatedCustomer(response.customer);
  }
  return {
    setAuthenticatedCustomer,
    passwordSession,
    account,
    setAccount,
    profile,
    setProfile,
    status,
    setStatus,
    loadError,
    setLoadError,
    reloadKey,
    setReloadKey,
    busy,
    setBusy,
    profileFeedback,
    setProfileFeedback,
    profileFeedbackRef,
    displayedAge,
    focusFeedback,
    saveProfile,
    applyPhotoUpdate,
  };
}
