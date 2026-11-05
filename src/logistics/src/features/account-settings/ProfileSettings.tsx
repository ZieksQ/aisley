import { AccountSettingsFeedback } from "@aisley/ui/account-settings";
import { AccountImagePreview, AccountRemovalConfirmation } from "@aisley/ui/account-settings";
import { useState } from "react";
import { LuCamera, LuSave, LuTrash2 } from 'react-icons/lu';
import { TextField as Field, SelectField } from "@aisley/ui";
import { LogisticsAvatar } from '../../components/LogisticsAvatar';
import type { useAccountSettings } from './use-account-settings';
const errorFor = (errors: Record<string, string[]>, field: string) => errors[field]?.[0];
export function ProfileSettings({ settings }: { settings: ReturnType<typeof useAccountSettings>; }) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const {
    account,
    profile,
    profileErrors,
    profileMessage,
    profileSaving,
    photo,
    photoProgress,
    photoBusy,
    photoError,
    photoMessage,
    updateProfileField,
    choosePhoto,
    uploadPhoto,
    removePhoto,
    saveProfile,
  } = settings;
  if (!account) return null;
  const initials = `${account.profile.first_name?.[0] ?? ''}${account.profile.last_name?.[0] ?? ''}`;
  return <>
    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">Personal profile</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Only your profile fields can be changed here.</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-white/10 sm:flex-row sm:items-center">
        <LogisticsAvatar
          className="size-20"
          initials={initials}
          photoUrl={account.profile.profile_photo_url}
        />
        <form className="min-w-0 flex-1" onSubmit={(event) => void uploadPhoto(event)}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Profile photo. JPEG, PNG, or WebP under 10 MB.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/10">
              <LuCamera />
              <span>
                {photo ? 'Choose another' : 'Choose photo'}</span>
              <input
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={photoBusy}
                onChange={choosePhoto}
                type="file"
              />
            </label>
            {photo ? <span className="max-w-56 truncate text-sm text-zinc-500">
              {photo.name}</span> : null}
            <button
              className="h-10 rounded-lg account-settings-primary px-4 text-sm font-semibold text-white  disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!photo || photoBusy}
              type="submit"
            >
              {photoBusy ? `Uploading… ${photoProgress}%` : 'Upload'}
            </button>
            {account.profile.profile_photo_url ? <button
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-400/10"
              disabled={photoBusy}
              onClick={() => setConfirmingRemove(true)}
              type="button"
            >
              <LuTrash2 />Remove
            </button> : null}
          </div>
          {photoBusy ? <div
            aria-label={`Uploading profile photo: ${photoProgress}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={photoProgress}
            className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10"
            role="progressbar"
          >
            <div className="h-full bg-[var(--settings-focus)] transition-[width] duration-150" style={{ width: `${photoProgress}%` }} />
          </div> : null}
          <AccountSettingsFeedback error={photoError} message={photoMessage} />

        </form>
      </div>
      <form className="mt-5 space-y-5" onSubmit={(event) => void saveProfile(event)}>
        <AccountSettingsFeedback error={Object.values(profileErrors).flat()[0]} message={profileMessage} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            error={errorFor(profileErrors, 'first_name')}
            id="first_name"
            label="First name *"
            onChange={(event) => updateProfileField('first_name', event.target.value)}
            required
            value={profile.first_name}
          />
          <Field
            error={errorFor(profileErrors, 'last_name')}
            id="last_name"
            label="Last name *"
            onChange={(event) => updateProfileField('last_name', event.target.value)}
            required
            value={profile.last_name}
          />
          <Field
            error={errorFor(profileErrors, 'middle_name')}
            id="middle_name"
            label="Middle name"
            onChange={(event) => updateProfileField('middle_name', event.target.value)}
            value={profile.middle_name}
          />
          <Field
            error={errorFor(profileErrors, 'contact_number')}
            id="contact_number"
            label="Contact number *"
            onChange={(event) => updateProfileField('contact_number', event.target.value)}
            required
            value={profile.contact_number}
          />
          <SelectField
            error={errorFor(profileErrors, 'sex')}
            id="sex"
            label="Sex *"
            onChange={(event) => updateProfileField('sex', event.target.value)}
            required
            value={profile.sex}
          >
            <option value="">Select
            </option>
            <option value="male">Male
            </option>
            <option value="female">Female
            </option>
            <option value="non_binary">Non-binary
            </option>
            <option value="prefer_not_to_say">Prefer not to say
            </option>
          </SelectField>
          <Field type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)}
            error={errorFor(profileErrors, 'birth_date')}
            id="birth_date"
            label="Birth date *"
            onChange={(event) => updateProfileField('birth_date', event.target.value)}
            required
            value={profile.birth_date}
          />
          <Field
            disabled
            id="age"
            label="Age (calculated)"
            value={account.profile.age === null ? '' : String(account.profile.age)}
          />
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg account-settings-primary px-4 text-sm font-semibold text-white  disabled:cursor-not-allowed disabled:opacity-60"
          disabled={profileSaving}
          type="submit"
        >
          <LuSave />
          {profileSaving ? 'Saving…' : 'Save profile'}
        </button>
      </form>
      <AccountImagePreview file={photo} />
    </section>
    {confirmingRemove ? <AccountRemovalConfirmation
      title="Remove profile photo?"
      confirmLabel="Remove photo"
      destructive
      busy={photoBusy}
      onClose={() => setConfirmingRemove(false)}
      onConfirm={() => void removePhoto().then(() => setConfirmingRemove(false))}
    >Your current profile photo will be removed. You can upload another image later.
    </AccountRemovalConfirmation> : null}</>;
}
