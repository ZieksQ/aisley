import { AccountImagePreview, AccountRemovalConfirmation, AccountSettingsFeedback } from "@aisley/ui/account-settings";
import { useState } from "react";
import { LuCamera, LuTrash2 } from 'react-icons/lu';
import { AdminAvatar } from '../../components/AdminAvatar';
import { FieldError, TextField } from './fields';
import type { useAccountSettings } from './use-account-settings';
export function ProfileSettings({ settings }: { settings: ReturnType<typeof useAccountSettings>; }) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const { account, profile, setProfile, photo, busy, errors, saveProfile, choosePhoto, uploadPhoto, removePhoto } = settings;
  if (!account) return null;
  const initials = `${account.profile.first_name?.[0] ?? ''}${account.profile.last_name?.[0] ?? ''}`;
  return <>
    <AccountSettingsFeedback error={["photo", "profile"].includes(settings.feedbackAction) ? settings.errors.form?.[0] ?? Object.values(settings.errors).flat()[0] : null} message={["photo", "profile"].includes(settings.feedbackAction) ? settings.message : null} />
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6" aria-labelledby="photo-heading">
      <h3 className="font-semibold" id="photo-heading">Profile photo</h3>
      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
        <AdminAvatar
          className="size-20"
          initials={initials}
          photoUrl={account.profile.profile_photo_url}
        />
        <form className="min-w-0 flex-1" onSubmit={uploadPhoto}>
          <p className="text-sm text-slate-500 dark:text-slate-400">JPEG, PNG, or WebP. Maximum 10 MB.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/5">
              <LuCamera />
              <span>Choose photo</span>
              <input
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={choosePhoto}
                type="file"
              />
            </label>
            {photo ? <span className="max-w-56 truncate text-sm text-slate-500 dark:text-slate-400">
              {photo.name}</span> : null}
            <button className="h-10 rounded-lg account-settings-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!photo || busy !== null}>
              {busy === 'photo' ? 'Uploading…' : 'Upload'}
            </button>
            {account.profile.profile_photo_url ? <button
              className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-400/10"
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
          label="First name"
          name="first_name"
          onChange={(value) => setProfile({ ...profile, first_name: value })}
          required
          value={profile.first_name}
          errors={errors}
        />
        <TextField
          label="Last name"
          name="last_name"
          onChange={(value) => setProfile({ ...profile, last_name: value })}
          required
          value={profile.last_name}
          errors={errors}
        />
        <TextField
          label="Middle name"
          name="middle_name"
          onChange={(value) => setProfile({ ...profile, middle_name: value })}
          value={profile.middle_name}
          errors={errors}
        />
        <TextField
          label="Contact number"
          name="contact_number"
          onChange={(value) => setProfile({ ...profile, contact_number: value })}
          value={profile.contact_number}
          errors={errors}
        />
        <label className="text-sm font-medium">Sex
          <select
            className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-white/15 dark:bg-[#171921]"
            onChange={(event) => setProfile({ ...profile, sex: event.target.value })}
            value={profile.sex}
          >
            <option value="">Not specified
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
          label="Birth date"
          name="birth_date"
          onChange={(value) => setProfile({ ...profile, birth_date: value })}
          type="date"
          value={profile.birth_date}
          errors={errors}
        />
      </div>
      <div className="mt-5 flex justify-end border-t border-slate-200 pt-5 dark:border-white/10">
        <button className="h-10 rounded-lg account-settings-primary px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== null}>
          {busy === 'profile' ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
    {confirmingRemove ? <AccountRemovalConfirmation
      title="Remove profile photo?"
      confirmLabel="Remove photo"
      destructive
      busy={busy === 'photo'}
      onClose={() => setConfirmingRemove(false)}
      onConfirm={() => void removePhoto().then(() => setConfirmingRemove(false))}
    >Your current profile photo will be removed. You can upload another image later.
    </AccountRemovalConfirmation> : null}</>;
}
