import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent, InputHTMLAttributes } from 'react'
import { FaCamera, FaCircleCheck, FaRotateRight, FaTrashCan } from 'react-icons/fa6'
import { useAuth } from '../auth/useAuth'
import { SellerAvatar } from '../components/SellerAvatar'
import { ApiError, apiRequest } from '../lib/api'
import type { SellerAccount, SellerAccountMutationResponse, SellerAccountResponse } from '../types/account'

type ProfileForm = {
  first_name: string
  last_name: string
  middle_name: string
  contact_number: string
  sex: string
  birth_date: string
}

type StorefrontForm = {
  name: string
  description: string
  contact_email: string
  contact_number: string
  website: string
  is_on_vacation: boolean
  vacation_message: string
}

const emptyProfile: ProfileForm = { first_name: '', last_name: '', middle_name: '', contact_number: '', sex: '', birth_date: '' }
const emptyStorefront: StorefrontForm = { name: '', description: '', contact_email: '', contact_number: '', website: '', is_on_vacation: false, vacation_message: '' }

export function AccountPage() {
  const { updateSeller } = useAuth()
  const [account, setAccount] = useState<SellerAccount | null>(null)
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile)
  const [storefront, setStorefront] = useState<StorefrontForm>(emptyStorefront)
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

  useEffect(() => { document.title = 'Account settings | Aisley Seller' }, [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setLoadError('')
    apiRequest<SellerAccountResponse>('/api/v1/seller/account', { signal: controller.signal })
      .then(({ account: next }) => {
        setAccount(next)
        setEmail(next.email)
        setProfile({
          first_name: next.profile.first_name ?? '',
          last_name: next.profile.last_name ?? '',
          middle_name: next.profile.middle_name ?? '',
          contact_number: next.profile.contact_number ?? '',
          sex: next.profile.sex ?? '',
          birth_date: next.profile.birth_date ?? '',
        })
        setStorefront({
          name: next.shop.name,
          description: next.shop.description ?? '',
          contact_email: next.shop.contact_email ?? '',
          contact_number: next.shop.contact_number ?? '',
          website: next.shop.website ?? '',
          is_on_vacation: next.shop.is_on_vacation,
          vacation_message: next.shop.vacation_message ?? '',
        })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Unable to load account settings.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [reload])

  function applyResponse(response: SellerAccountMutationResponse) {
    setAccount(response.account)
    updateSeller(response.seller)
    setMessage(response.message)
    setErrors({})
  }

  function begin(action: string) {
    setBusy(action)
    setMessage('')
    setErrors({})
  }

  function fail(error: unknown) {
    setErrors(error instanceof ApiError ? error.errors : { form: [error instanceof Error ? error.message : 'The request could not be completed.'] })
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    begin('profile')
    try {
      const response = await apiRequest<SellerAccountMutationResponse>('/api/v1/seller/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({ ...profile, middle_name: profile.middle_name || null }),
      })
      applyResponse(response)
    } catch (error) { fail(error) } finally { setBusy(null) }
  }

  async function saveStorefront(event: FormEvent) {
    event.preventDefault()
    begin('storefront')
    try {
      const response = await apiRequest<SellerAccountMutationResponse>('/api/v1/seller/account/storefront', {
        method: 'PATCH',
        body: JSON.stringify({
          ...storefront,
          description: storefront.description || null,
          contact_email: storefront.contact_email || null,
          contact_number: storefront.contact_number || null,
          website: storefront.website || null,
          vacation_message: storefront.vacation_message || null,
        }),
      })
      applyResponse(response)
    } catch (error) { fail(error) } finally { setBusy(null) }
  }

  async function saveEmail(event: FormEvent) {
    event.preventDefault()
    begin('email')
    try {
      const response = await apiRequest<SellerAccountMutationResponse>('/api/v1/seller/account/email', {
        method: 'PATCH', body: JSON.stringify({ email, current_password: emailPassword }),
      })
      applyResponse(response)
      setEmailPassword('')
    } catch (error) { fail(error) } finally { setBusy(null) }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    begin('password')
    try {
      const response = await apiRequest<{ message: string }>('/api/v1/seller/account/password', { method: 'PUT', body: JSON.stringify(passwords) })
      setMessage(response.message)
      setPasswords({ current_password: '', password: '', password_confirmation: '' })
    } catch (error) { fail(error) } finally { setBusy(null) }
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    setErrors({})
    setMessage('')
    if (selected && selected.size >= 10 * 1024 * 1024) {
      setErrors({ photo: ['The profile photo must be smaller than 10 MB.'] })
      setPhoto(null)
      return
    }
    setPhoto(selected)
  }

  async function uploadPhoto(event: FormEvent) {
    event.preventDefault()
    if (!photo) return
    begin('photo')
    const body = new FormData()
    body.append('photo', photo)
    try {
      const response = await apiRequest<SellerAccountMutationResponse>('/api/v1/seller/account/profile-photo', { method: 'POST', body })
      applyResponse(response)
      setPhoto(null)
    } catch (error) { fail(error) } finally { setBusy(null) }
  }

  async function removePhoto() {
    if (!window.confirm('Remove your current profile photo?')) return
    begin('photo')
    try {
      const response = await apiRequest<SellerAccountMutationResponse>('/api/v1/seller/account/profile-photo', { method: 'DELETE' })
      applyResponse(response)
      setPhoto(null)
    } catch (error) { fail(error) } finally { setBusy(null) }
  }

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"><div className="h-96 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-white/[0.035]" /></div>
  if (loadError || !account) return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8"><div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200"><p>{loadError || 'Account settings are unavailable.'}</p><button className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold dark:border-red-400/30" onClick={() => setReload((value) => value + 1)}><FaRotateRight />Try again</button></div></div>

  const initials = `${account.profile.first_name?.[0] ?? 'S'}${account.profile.last_name?.[0] ?? ''}`

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-zinc-200 pb-5 dark:border-white/10">
        <h2 className="text-2xl font-semibold tracking-tight">Account settings</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Manage your Seller profile, storefront, and sign-in credentials.</p>
      </div>

      {message ? <div aria-live="polite" className="mt-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"><FaCircleCheck />{message}</div> : null}
      {errors.form?.[0] ? <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200" role="alert">{errors.form[0]}</p> : null}

      <section aria-labelledby="photo-heading" className={sectionClass}>
        <h3 className="font-semibold" id="photo-heading">Profile photo</h3>
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
          <SellerAvatar className="size-20" initials={initials} photoUrl={account.profile.profile_photo_url} />
          <form className="min-w-0 flex-1" onSubmit={uploadPhoto}>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">JPEG, PNG, or WebP. Maximum 10 MB.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/5"><FaCamera /><span>Choose photo</span><input accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" onChange={choosePhoto} type="file" /></label>
              {photo ? <span className="max-w-56 truncate text-sm text-zinc-500">{photo.name}</span> : null}
              <button className={primaryButtonClass} disabled={!photo || busy === 'photo'}>{busy === 'photo' ? 'Uploading…' : 'Upload'}</button>
              {account.profile.profile_photo_url ? <button className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-400/10" disabled={busy === 'photo'} onClick={() => void removePhoto()} type="button"><FaTrashCan />Remove</button> : null}
            </div>
            <FieldError errors={errors} name="photo" />
          </form>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form className={sectionClassNoMargin} onSubmit={saveProfile}>
          <h3 className="font-semibold">Profile information</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField errors={errors} label="First name" name="first_name" onChange={(value) => setProfile({ ...profile, first_name: value })} required value={profile.first_name} />
            <TextField errors={errors} label="Last name" name="last_name" onChange={(value) => setProfile({ ...profile, last_name: value })} required value={profile.last_name} />
            <TextField errors={errors} label="Middle initial" maxLength={1} name="middle_name" onChange={(value) => setProfile({ ...profile, middle_name: value })} value={profile.middle_name} />
            <TextField errors={errors} label="Contact number" name="contact_number" onChange={(value) => setProfile({ ...profile, contact_number: value })} required value={profile.contact_number} />
            <label className="text-sm font-medium">Sex <span className="text-red-600">*</span><select className={inputClass} onChange={(event) => setProfile({ ...profile, sex: event.target.value })} required value={profile.sex}><option disabled value="">Select an option</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></select><FieldError errors={errors} name="sex" /></label>
            <TextField errors={errors} label="Birth date" name="birth_date" onChange={(value) => setProfile({ ...profile, birth_date: value })} required type="date" value={profile.birth_date} />
          </div>
          <FormActions busy={busy === 'profile'} label="Save profile" progress="Saving…" />
        </form>

        <form className={sectionClassNoMargin} onSubmit={saveStorefront}>
          <h3 className="font-semibold">Storefront information</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <TextField errors={errors} label="Shop name" name="name" onChange={(value) => setStorefront({ ...storefront, name: value })} required value={storefront.name} />
            <TextField errors={errors} label="Store contact email" name="contact_email" onChange={(value) => setStorefront({ ...storefront, contact_email: value })} type="email" value={storefront.contact_email} />
            <TextField errors={errors} label="Store contact number" name="contact_number" onChange={(value) => setStorefront({ ...storefront, contact_number: value })} value={storefront.contact_number} />
            <TextField errors={errors} label="Website" name="website" onChange={(value) => setStorefront({ ...storefront, website: value })} placeholder="https://" type="url" value={storefront.website} />
            <label className="text-sm font-medium sm:col-span-2">Description<textarea className={`${inputClass} min-h-28 py-3`} onChange={(event) => setStorefront({ ...storefront, description: event.target.value })} value={storefront.description} /><FieldError errors={errors} name="description" /></label>
            <label className="flex items-start gap-3 sm:col-span-2"><input checked={storefront.is_on_vacation} className="mt-1 size-4 accent-[#4C1268]" onChange={(event) => setStorefront({ ...storefront, is_on_vacation: event.target.checked })} type="checkbox" /><span><span className="block text-sm font-medium">Vacation mode</span><span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">Prevents checkout from accepting products from this shop while enabled.</span></span></label>
            {storefront.is_on_vacation ? <label className="text-sm font-medium sm:col-span-2">Vacation message <span className="text-red-600">*</span><textarea className={`${inputClass} min-h-24 py-3`} onChange={(event) => setStorefront({ ...storefront, vacation_message: event.target.value })} required value={storefront.vacation_message} /><FieldError errors={errors} name="vacation_message" /></label> : null}
          </div>
          <FormActions busy={busy === 'storefront'} label="Save storefront" progress="Saving…" />
        </form>
      </div>

      <section aria-labelledby="security-heading" className={sectionClass}>
        <h3 className="font-semibold" id="security-heading">Sign-in security</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Two-factor authentication is not available yet. Current-password confirmation protects email and password edits for now.</p>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <form className="rounded-lg border border-zinc-200 p-4 dark:border-white/10" onSubmit={saveEmail}>
            <h4 className="font-medium">Email address</h4>
            <div className="mt-4 space-y-4"><TextField autoComplete="email" errors={errors} label="Email" name="email" onChange={setEmail} required type="email" value={email} /><TextField autoComplete="current-password" errors={errors} label="Current password" name="current_password" onChange={setEmailPassword} required type="password" value={emailPassword} /></div>
            <button className={`${primaryButtonClass} mt-5 w-full`} disabled={busy === 'email'}>{busy === 'email' ? 'Updating…' : 'Update email'}</button>
          </form>
          <form className="rounded-lg border border-zinc-200 p-4 dark:border-white/10" onSubmit={savePassword}>
            <h4 className="font-medium">Password</h4>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">At least 8 characters with uppercase, lowercase, and a number.</p>
            <div className="mt-4 space-y-4"><TextField autoComplete="current-password" errors={errors} label="Current password" name="current_password" onChange={(value) => setPasswords({ ...passwords, current_password: value })} required type="password" value={passwords.current_password} /><TextField autoComplete="new-password" errors={errors} label="New password" name="password" onChange={(value) => setPasswords({ ...passwords, password: value })} required type="password" value={passwords.password} /><TextField autoComplete="new-password" errors={errors} label="Confirm new password" name="password_confirmation" onChange={(value) => setPasswords({ ...passwords, password_confirmation: value })} required type="password" value={passwords.password_confirmation} /></div>
            <button className={`${primaryButtonClass} mt-5 w-full`} disabled={busy === 'password'}>{busy === 'password' ? 'Updating…' : 'Update password'}</button>
          </form>
        </div>
      </section>
    </div>
  )
}

const sectionClass = 'mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6'
const sectionClassNoMargin = 'rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-white/[0.035] sm:p-6'
const inputClass = 'mt-1.5 h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-[#E6007A] focus:ring-2 focus:ring-pink-100 dark:border-white/15 dark:bg-[#171719] dark:focus:ring-pink-500/10'
const primaryButtonClass = 'h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white disabled:opacity-50'

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'onChange' | 'value'> & {
  errors: Record<string, string[]>
  label: string
  name: string
  onChange: (value: string) => void
  value: string
}

function TextField({ autoComplete, errors, label, name, onChange, required, type = 'text', value, ...props }: TextFieldProps) {
  const errorId = errors[name]?.[0] ? `${name}-error` : undefined
  return <label className="text-sm font-medium">{label}{required ? <span className="text-red-600"> *</span> : null}<input {...props} aria-describedby={errorId} aria-invalid={Boolean(errorId)} autoComplete={autoComplete} className={inputClass} name={name} onChange={(event) => onChange(event.target.value)} required={required} type={type} value={value} /><FieldError errors={errors} name={name} /></label>
}

function FieldError({ errors, name }: { errors: Record<string, string[]>; name: string }) {
  return errors[name]?.[0] ? <span className="mt-1 block text-xs text-red-700 dark:text-red-300" id={`${name}-error`}>{errors[name][0]}</span> : null
}

function FormActions({ busy, label, progress }: { busy: boolean; label: string; progress: string }) {
  return <div className="mt-5 flex justify-end border-t border-zinc-200 pt-5 dark:border-white/10"><button className={primaryButtonClass} disabled={busy}>{busy ? progress : label}</button></div>
}
