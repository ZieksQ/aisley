import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { FaCamera, FaCircleCheck, FaRotateRight, FaTrashCan } from 'react-icons/fa6'
import { useAuth } from '../auth/useAuth'
import { AdminAvatar } from '../components/AdminAvatar'
import { ApiError, apiRequest } from '../lib/api'
import type { AdminAccount, AdminAccountMutationResponse, AdminAccountResponse } from '../types/account'

type ProfileForm = {
  first_name: string
  last_name: string
  middle_name: string
  contact_number: string
  sex: string
  birth_date: string
}

const emptyProfile: ProfileForm = {
  first_name: '', last_name: '', middle_name: '', contact_number: '', sex: '', birth_date: '',
}

export function AccountPage() {
  const { updateAdmin } = useAuth()
  const [account, setAccount] = useState<AdminAccount | null>(null)
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile)
  const [email, setEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [passwords, setPasswords] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [message, setMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => { document.title = 'Account settings | Aisley Admin' }, [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true); setLoadError('')
    apiRequest<AdminAccountResponse>('/api/v1/admin/account', { signal: controller.signal })
      .then(({ account: next }) => {
        setAccount(next); setEmail(next.email)
        setProfile({
          first_name: next.profile.first_name ?? '', last_name: next.profile.last_name ?? '',
          middle_name: next.profile.middle_name ?? '', contact_number: next.profile.contact_number ?? '',
          sex: next.profile.sex ?? '', birth_date: next.profile.birth_date ?? '',
        })
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Unable to load account settings.') })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
    return () => controller.abort()
  }, [reload])

  function applyResponse(response: AdminAccountMutationResponse) {
    setAccount(response.account); updateAdmin(response.admin); setMessage(response.message); setErrors({})
  }

  function begin(action: string) { setBusy(action); setMessage(''); setErrors({}) }
  function fail(error: unknown) { setErrors(error instanceof ApiError ? error.errors : { form: [error instanceof Error ? error.message : 'The request could not be completed.'] }) }
  function finish() { setBusy(null) }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); begin('profile')
    try {
      const response = await apiRequest<AdminAccountMutationResponse>('/api/v1/admin/account/profile', {
        method: 'PATCH', body: JSON.stringify({ ...profile, middle_name: profile.middle_name || null, contact_number: profile.contact_number || null, sex: profile.sex || null, birth_date: profile.birth_date || null }),
      })
      applyResponse(response)
    } catch (error) { fail(error) } finally { finish() }
  }

  async function saveEmail(event: FormEvent) {
    event.preventDefault(); begin('email')
    try {
      const response = await apiRequest<AdminAccountMutationResponse>('/api/v1/admin/account/email', { method: 'PATCH', body: JSON.stringify({ email, current_password: emailPassword }) })
      applyResponse(response); setEmailPassword('')
    } catch (error) { fail(error) } finally { finish() }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault(); begin('password')
    try {
      const response = await apiRequest<{ message: string }>('/api/v1/admin/account/password', { method: 'PUT', body: JSON.stringify(passwords) })
      setMessage(response.message); setPasswords({ current_password: '', password: '', password_confirmation: '' })
    } catch (error) { fail(error) } finally { finish() }
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    setErrors({}); setMessage('')
    if (selected && selected.size >= 10 * 1024 * 1024) {
      setErrors({ photo: ['The profile photo must be smaller than 10 MB.'] }); setPhoto(null); return
    }
    setPhoto(selected)
  }

  async function uploadPhoto(event: FormEvent) {
    event.preventDefault(); if (!photo) return
    begin('photo')
    const body = new FormData(); body.append('photo', photo)
    try {
      const response = await apiRequest<AdminAccountMutationResponse>('/api/v1/admin/account/profile-photo', { method: 'POST', body })
      applyResponse(response); setPhoto(null)
    } catch (error) { fail(error) } finally { finish() }
  }

  async function removePhoto() {
    if (!window.confirm('Remove your current profile photo?')) return
    begin('photo')
    try {
      const response = await apiRequest<AdminAccountMutationResponse>('/api/v1/admin/account/profile-photo', { method: 'DELETE' })
      applyResponse(response); setPhoto(null)
    } catch (error) { fail(error) } finally { finish() }
  }

  if (isLoading) return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8"><div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]" /></div>
  if (loadError || !account) return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8"><div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200"><p>{loadError || 'Account settings are unavailable.'}</p><button className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold dark:border-rose-400/30" onClick={() => setReload((value) => value + 1)}><FaRotateRight />Try again</button></div></div>

  const initials = `${account.profile.first_name?.[0] ?? 'A'}${account.profile.last_name?.[0] ?? ''}`
  return <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
    <div className="border-b border-slate-200 pb-5 dark:border-white/10"><h2 className="text-2xl font-semibold tracking-tight">Account settings</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Manage your own administrator profile and login credentials.</p></div>
    {message ? <div aria-live="polite" className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"><FaCircleCheck />{message}</div> : null}
    {errors.form?.[0] ? <p className="mt-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200" role="alert">{errors.form[0]}</p> : null}

    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6" aria-labelledby="photo-heading"><h3 className="font-semibold" id="photo-heading">Profile photo</h3><div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center"><AdminAvatar className="size-20" initials={initials} photoUrl={account.profile.profile_photo_url} /><form className="min-w-0 flex-1" onSubmit={uploadPhoto}><p className="text-sm text-slate-500 dark:text-slate-400">JPEG, PNG, or WebP. Maximum 10 MB.</p><div className="mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/5"><FaCamera /><span>Choose photo</span><input accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" onChange={choosePhoto} type="file" /></label>{photo ? <span className="max-w-56 truncate text-sm text-slate-500">{photo.name}</span> : null}<button className="h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={!photo || busy === 'photo'}>{busy === 'photo' ? 'Uploading…' : 'Upload'}</button>{account.profile.profile_photo_url ? <button className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-400/10" disabled={busy === 'photo'} onClick={() => void removePhoto()} type="button"><FaTrashCan />Remove</button> : null}</div><FieldError errors={errors} name="photo" /></form></div></section>

    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.85fr)]">
      <form className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6" onSubmit={saveProfile}><h3 className="font-semibold">Profile information</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><TextField label="First name" name="first_name" onChange={(value) => setProfile({ ...profile, first_name: value })} required value={profile.first_name} errors={errors} /><TextField label="Last name" name="last_name" onChange={(value) => setProfile({ ...profile, last_name: value })} required value={profile.last_name} errors={errors} /><TextField label="Middle name" name="middle_name" onChange={(value) => setProfile({ ...profile, middle_name: value })} value={profile.middle_name} errors={errors} /><TextField label="Contact number" name="contact_number" onChange={(value) => setProfile({ ...profile, contact_number: value })} value={profile.contact_number} errors={errors} /><label className="text-sm font-medium">Sex<select className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 dark:border-white/15 dark:bg-[#171921]" onChange={(event) => setProfile({ ...profile, sex: event.target.value })} value={profile.sex}><option value="">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select><FieldError errors={errors} name="sex" /></label><TextField label="Birth date" name="birth_date" onChange={(value) => setProfile({ ...profile, birth_date: value })} type="date" value={profile.birth_date} errors={errors} /></div><div className="mt-5 flex justify-end border-t border-slate-200 pt-5 dark:border-white/10"><button className="h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save profile'}</button></div></form>

      <div className="space-y-6"><form className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6" onSubmit={saveEmail}><h3 className="font-semibold">Email address</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Used to sign in to the Admin application.</p><div className="mt-4 space-y-4"><TextField autoComplete="email" label="Email" name="email" onChange={setEmail} required type="email" value={email} errors={errors} /><TextField autoComplete="current-password" label="Current password" name="current_password" onChange={setEmailPassword} required type="password" value={emailPassword} errors={errors} /></div><button className="mt-5 h-10 w-full rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy === 'email'}>{busy === 'email' ? 'Updating…' : 'Update email'}</button></form>

        <form className="rounded-xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6" onSubmit={savePassword}><h3 className="font-semibold">Password</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use at least 8 characters with uppercase, lowercase, and a number.</p><div className="mt-4 space-y-4"><TextField autoComplete="current-password" label="Current password" name="current_password" onChange={(value) => setPasswords({ ...passwords, current_password: value })} required type="password" value={passwords.current_password} errors={errors} /><TextField autoComplete="new-password" label="New password" name="password" onChange={(value) => setPasswords({ ...passwords, password: value })} required type="password" value={passwords.password} errors={errors} /><TextField autoComplete="new-password" label="Confirm new password" name="password_confirmation" onChange={(value) => setPasswords({ ...passwords, password_confirmation: value })} required type="password" value={passwords.password_confirmation} errors={errors} /></div><button className="mt-5 h-10 w-full rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy === 'password'}>{busy === 'password' ? 'Updating…' : 'Update password'}</button></form></div>
    </div>
  </div>
}

function TextField({ autoComplete, errors, label, name, onChange, required, type = 'text', value }: { autoComplete?: string; errors: Record<string, string[]>; label: string; name: string; onChange: (value: string) => void; required?: boolean; type?: string; value: string }) {
  const errorId = errors[name]?.[0] ? `${name}-error` : undefined
  return <label className="text-sm font-medium">{label}{required ? <span className="text-rose-600"> *</span> : null}<input aria-describedby={errorId} aria-invalid={Boolean(errorId)} autoComplete={autoComplete} className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-[#E6007A] focus:ring-3 focus:ring-pink-100 dark:border-white/15 dark:bg-[#171921] dark:focus:ring-pink-500/10" onChange={(event) => onChange(event.target.value)} required={required} type={type} value={value} /><FieldError errors={errors} name={name} /></label>
}

function FieldError({ errors, name }: { errors: Record<string, string[]>; name: string }) {
  return errors[name]?.[0] ? <span className="mt-1 block text-xs text-rose-700 dark:text-rose-300" id={`${name}-error`}>{errors[name][0]}</span> : null
}
