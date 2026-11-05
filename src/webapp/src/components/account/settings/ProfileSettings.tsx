"use client";
import { ProfilePhotoSection } from "@/components/account/profile-photo-section";
import type {
  CustomerProfilePayload
} from "@/lib/account/types";
import { firstFieldError } from "@/lib/api";
import { Button, SelectField, TextField } from "@aisley/ui";
import { FiCheckCircle } from "react-icons/fi";
import type { useAccountSettings } from './use-account-settings';
export function ProfileSettings({ settings }: { settings: ReturnType<typeof useAccountSettings>; }) {
  const { account, profile, setProfile, busy, profileFeedback, profileFeedbackRef, displayedAge, saveProfile, applyPhotoUpdate } = settings;
  if (!account) return null;
  return <>
    <ProfilePhotoSection account={account} onUpdated={applyPhotoUpdate} />
    <form
      onSubmit={saveProfile}
      className="account-settings-form"
      noValidate
    >
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
          <span>
            {profileFeedback.error?.message ?? profileFeedback.message}</span>
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
          <option value="" disabled>Select an option
          </option>
          <option value="female">Female
          </option>
          <option value="male">Male
          </option>
          <option value="non_binary">Non-binary
          </option>
          <option value="prefer_not_to_say">Prefer not to say
          </option>
        </SelectField>
      </fieldset>
      <div className="mt-6 flex justify-end border-t border-[#E9E4EB] pt-5">
        <Button variant="secondary"
          type="submit"
          className="min-h-10 rounded-md px-5"
          isLoading={busy === "profile"}
          loadingLabel="Saving profile"
          disabled={busy !== null}
        >
          Save profile
        </Button>
      </div>
    </form></>;
}
