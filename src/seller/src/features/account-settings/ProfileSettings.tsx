import { AccountImagePreview, AccountRemovalConfirmation, AccountSettingsFeedback } from "@aisley/ui/account-settings";
import { useState } from "react";
import { LuCamera, LuTrash2 } from 'react-icons/lu';
import { SellerAvatar } from '../../components/SellerAvatar';
import { FieldError, FormActions, inputClass, primaryButtonClass, sectionClass, TextField } from './fields';
import type { useAccountSettings } from './use-account-settings';
export function ProfileSettings({ settings }: { settings: ReturnType<typeof useAccountSettings>; }) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const { account, profile, setProfile, photo, busy, errors, saveProfile, choosePhoto, uploadPhoto, removePhoto } = settings;
  if (!account) return null;
  const initials = `${account.profile.first_name?.[0] ?? ''}${account.profile.last_name?.[0] ?? ''}`;
  return <>
    <AccountSettingsFeedback error={["photo", "profile"].includes(settings.feedbackAction) ? settings.errors.form?.[0] ?? Object.values(settings.errors).flat()[0] : null} message={["photo", "profile"].includes(settings.feedbackAction) ? settings.message : null} />
    <section aria-labelledby="photo-heading" className={sectionClass}>
      <h3 className="font-semibold" id="photo-heading">Profile photo</h3>
      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
        <SellerAvatar
          className="size-20"
          initials={initials}
          photoUrl={account.profile.profile_photo_url}
        />
        <form className="min-w-0 flex-1" onSubmit={uploadPhoto}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">JPEG, PNG, or WebP. Maximum 10 MB.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5">
              <LuCamera />
              <span>Choose photo</span>
              <input
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={choosePhoto}
                type="file"
              />
            </label>
            {photo ? <span className="max-w-56 truncate text-sm text-zinc-500">
              {photo.name}</span> : null}
            <button className={primaryButtonClass} disabled={!photo || busy !== null}>
              {busy === 'photo' ? 'Uploading…' : 'Upload'}
            </button>
            {account.profile.profile_photo_url ? <button
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-400/10"
              disabled={busy !== null}
              onClick={() => setConfirmingRemove(true)}
              type="button"
            >
              <LuTrash2 />Remove
            </button> : null}
          </div>
          <FieldError errors={errors} name="photo" />
        </form>
      </div>
      <AccountImagePreview file={photo} />
    </section>
    <form className="account-settings-form" onSubmit={saveProfile}>
      <h3 className="font-semibold">Profile information</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <TextField
          errors={errors}
          label="First name"
          name="first_name"
          onChange={(value) => setProfile({ ...profile, first_name: value })}
          required
          value={profile.first_name}
        />
        <TextField
          errors={errors}
          label="Last name"
          name="last_name"
          onChange={(value) => setProfile({ ...profile, last_name: value })}
          required
          value={profile.last_name}
        />
        <TextField
          errors={errors}
          label="Middle initial"
          maxLength={1}
          name="middle_name"
          onChange={(value) => setProfile({ ...profile, middle_name: value })}
          value={profile.middle_name}
        />
        <TextField
          errors={errors}
          label="Contact number"
          name="contact_number"
          onChange={(value) => setProfile({ ...profile, contact_number: value })}
          required
          value={profile.contact_number}
        />
        <label className="text-sm font-medium">Sex
          <span className="text-red-600">*</span>
          <select
            className={inputClass}
            onChange={(event) => setProfile({ ...profile, sex: event.target.value })}
            required
            value={profile.sex}
          >
            <option disabled value="">Select an option
            </option>
            <option value="female">Female
            </option>
            <option value="male">Male
            </option>
            <option value="non_binary">Non-binary
            </option>
            <option value="prefer_not_to_say">Prefer not to say
            </option>
          </select>
          <FieldError errors={errors} name="sex" />
        </label>
        <TextField
          errors={errors}
          label="Birth date"
          name="birth_date"
          onChange={(value) => setProfile({ ...profile, birth_date: value })}
          required
          type="date"
          value={profile.birth_date}
        />
      </div>
      <FormActions
        busy={busy === 'profile'} disabled={busy !== null}
        label="Save profile"
        progress="Saving…"
      />
    </form>
    {confirmingRemove ? <AccountRemovalConfirmation
      title="Remove profile photo?"
      confirmLabel="Remove photo"
      destructive
      busy={busy === 'photo'} confirmDisabled={busy !== null}
      onClose={() => setConfirmingRemove(false)}
      onConfirm={() => void removePhoto().then(() => setConfirmingRemove(false))}
    >Your current profile photo will be removed. You can upload another image later.
    </AccountRemovalConfirmation> : null}</>;
}
