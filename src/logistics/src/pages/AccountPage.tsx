import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { FaArrowsRotate, FaCamera, FaFloppyDisk, FaLock, FaTrashCan } from 'react-icons/fa6'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Field, SelectField } from '../components/Field'
import { FlatpickrField } from '../components/FlatpickrInput'
import { LogisticsAvatar } from '../components/LogisticsAvatar'
import { HubLocationPicker, type HubCoordinates, type HubAddress } from '../components/HubLocationPicker'
import { ApiError, request, uploadForm } from '../lib/api'
import type { AccountResponse, LogisticsAccount } from '../types/account'

type ProfileForm = {
  first_name: string
  middle_name: string
  last_name: string
  contact_number: string
  sex: string
  birth_date: string
}

type OrganizationForm = { business_name: string; hub_name: string }
type PasswordForm = { current_password: string; password: string; password_confirmation: string }
type Errors = Record<string, string[]>

const emptyProfile: ProfileForm = { first_name: '', middle_name: '', last_name: '', contact_number: '', sex: '', birth_date: '' }
const emptyOrganization: OrganizationForm = { business_name: '', hub_name: '' }
const emptyPassword: PasswordForm = { current_password: '', password: '', password_confirmation: '' }

function errorFor(errors: Errors, field: string): string | undefined {
  return errors[field]?.[0]
}

function formError(caught: unknown, fallback: string): { message: string; errors: Errors } {
  if (!(caught instanceof ApiError)) return { message: fallback, errors: {} }
  if (caught.status === 409) return { message: 'This account changed while you were editing. Reload the latest values and try again.', errors: caught.errors }
  if (caught.status === 422) return { message: Object.keys(caught.errors).length ? 'Please correct the highlighted fields.' : caught.message, errors: caught.errors }
  if (caught.status === 429) return { message: 'Too many attempts. Wait a moment before trying again.', errors: caught.errors }
  if (caught.status === 403) return { message: 'This account is not allowed to change these settings.', errors: caught.errors }
  return { message: caught.message || fallback, errors: caught.errors }
}

export function AccountPage() {
  const { logout, refresh } = useAuth()
  const navigate = useNavigate()
  const [account, setAccount] = useState<LogisticsAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile)
  const [organization, setOrganization] = useState<OrganizationForm>(emptyOrganization)
  const [password, setPassword] = useState<PasswordForm>(emptyPassword)
  const [profileErrors, setProfileErrors] = useState<Errors>({})
  const [organizationErrors, setOrganizationErrors] = useState<Errors>({})
  const [passwordErrors, setPasswordErrors] = useState<Errors>({})
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [organizationMessage, setOrganizationMessage] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)
  const [organizationSaving, setOrganizationSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoProgress, setPhotoProgress] = useState(0)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoMessage, setPhotoMessage] = useState<string | null>(null)
  const [hubLocation, setHubLocation] = useState<HubCoordinates | null>(null)
  const [hubLocationConfirmed, setHubLocationConfirmed] = useState(false)
  const [hubLocationReason, setHubLocationReason] = useState('')
  const [hubLocationError, setHubLocationError] = useState<string | null>(null)
  const [hubLocationMessage, setHubLocationMessage] = useState<string | null>(null)
  const [hubLocationSaving, setHubLocationSaving] = useState(false)
  const geoapifyApiKey = import.meta.env.GEOAPIFY_API_KEY ?? ''

  useEffect(() => { document.title = 'Account settings | Aisley' }, [])

  function applyAccount(next: LogisticsAccount) {
    setAccount(next)
    setProfile({
      first_name: next.profile.first_name ?? '',
      middle_name: next.profile.middle_name ?? '',
      last_name: next.profile.last_name ?? '',
      contact_number: next.profile.contact_number ?? '',
      sex: next.profile.sex ?? '',
      birth_date: next.profile.birth_date ?? '',
    })
    setOrganization({
      business_name: next.organization.business_name ?? '',
      hub_name: next.hub.name ?? '',
    })
    const location = next.hub.location
    if (location && location.latitude !== null && location.longitude !== null) {
      setHubLocation({ latitude: location.latitude, longitude: location.longitude })
      setHubLocationConfirmed(true)
    } else {
      setHubLocation(null)
      setHubLocationConfirmed(false)
    }
    setHubLocationReason('')
  }

  async function load() {
    setLoading(true)
    setLoadingError(null)
    try {
      const data = await request<AccountResponse>('/api/v1/logistics/account')
      applyAccount(data.account)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        await logout().catch(() => undefined)
        navigate('/login', { replace: true })
        return
      }
      if (caught instanceof ApiError && caught.status === 404) setLoadingError('The approved Logistics profile or sole hub is unavailable. Contact an administrator.')
      else if (caught instanceof ApiError && caught.status === 403) setLoadingError('This Logistics account is not allowed to use account settings.')
      else setLoadingError(caught instanceof ApiError ? caught.message : 'We could not reach the API. Check that it is running and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function updateProfileField(field: keyof ProfileForm, value: string) {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    event.currentTarget.value = ''
    setPhotoError(null)
    setPhotoMessage(null)
    setPhotoProgress(0)
    if (!selected) return

    const parts = selected.name.toLowerCase().split('.')
    const extension = parts.at(-1)
    if (parts.length > 2 || !extension || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
      setPhoto(null)
      setPhotoError('Choose a JPEG, PNG, or WebP image with one file extension.')
      return
    }
    if (selected.size >= 10 * 1024 * 1024) {
      setPhoto(null)
      setPhotoError('The profile photo must be smaller than 10 MB.')
      return
    }
    setPhoto(selected)
  }

  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!photo) return
    setPhotoBusy(true)
    setPhotoError(null)
    setPhotoMessage(null)
    try {
      const body = new FormData()
      body.append('photo', photo)
      const data = await uploadForm<AccountResponse>('/api/v1/logistics/account/profile-photo', body, setPhotoProgress)
      applyAccount(data.account)
      await refresh().catch(() => undefined)
      setPhoto(null)
      setPhotoMessage(data.message ?? 'Profile photo updated successfully.')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) { await logout().catch(() => undefined); navigate('/login', { replace: true }); return }
      const result = formError(caught, 'We could not upload your profile photo. Try again.')
      setPhotoError(result.errors.photo?.[0] ?? result.message)
    } finally { setPhotoBusy(false) }
  }

  async function removePhoto() {
    if (!account?.profile.profile_photo_url || !window.confirm('Remove your current profile photo?')) return
    setPhotoBusy(true)
    setPhotoError(null)
    setPhotoMessage(null)
    try {
      const data = await request<AccountResponse>('/api/v1/logistics/account/profile-photo', { method: 'DELETE' })
      applyAccount(data.account)
      await refresh().catch(() => undefined)
      setPhotoMessage(data.message ?? 'Profile photo removed successfully.')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) { await logout().catch(() => undefined); navigate('/login', { replace: true }); return }
      const result = formError(caught, 'We could not remove your profile photo. Try again.')
      setPhotoError(result.message)
    } finally { setPhotoBusy(false) }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProfileErrors({})
    setProfileMessage(null)
    setProfileSaving(true)
    try {
      const data = await request<AccountResponse>('/api/v1/logistics/account/profile', { method: 'PATCH', body: JSON.stringify(profile) })
      applyAccount(data.account)
      await refresh().catch(() => undefined)
      setProfileMessage(data.message ?? 'Profile updated successfully.')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) { await logout().catch(() => undefined); navigate('/login', { replace: true }); return }
      const result = formError(caught, 'We could not save your profile. Try again.')
      setProfileErrors(result.errors)
      setProfileMessage(result.message)
    } finally { setProfileSaving(false) }
  }

  async function saveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOrganizationErrors({})
    setOrganizationMessage(null)
    setOrganizationSaving(true)
    try {
      const data = await request<AccountResponse>('/api/v1/logistics/account/organization', { method: 'PATCH', body: JSON.stringify(organization) })
      applyAccount(data.account)
      await refresh().catch(() => undefined)
      setOrganizationMessage(data.message ?? 'Organization details updated successfully.')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) { await logout().catch(() => undefined); navigate('/login', { replace: true }); return }
      const result = formError(caught, 'We could not save organization details. Try again.')
      setOrganizationErrors(result.errors)
      setOrganizationMessage(result.message)
    } finally { setOrganizationSaving(false) }
  }

  async function saveHubLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setHubLocationError(null); setHubLocationMessage(null)
    if (!account) return
    if (!hubLocation || !hubLocationConfirmed) { setHubLocationError('Choose the exact hub pin and confirm it before saving.'); return }
    if (!account.hub.location?.expected_updated_at) { setHubLocationError('The hub location revision is unavailable. Reload the account and try again.'); return }
    if (hubLocationReason.trim().length < 3) { setHubLocationError('Give a short reason for this same-premises pin correction.'); return }
    setHubLocationSaving(true)
    try {
      const data = await request<AccountResponse>('/api/v1/logistics/account/hub-location', { method: 'PUT', body: JSON.stringify({ latitude: hubLocation.latitude, longitude: hubLocation.longitude, expected_updated_at: account.hub.location.expected_updated_at, reason: hubLocationReason.trim() }) })
      applyAccount(data.account); await refresh().catch(() => undefined); setHubLocationMessage(data.message ?? 'Hub location updated successfully.')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) { await logout().catch(() => undefined); navigate('/login', { replace: true }); return }
      if (caught instanceof ApiError && caught.status === 409) { setHubLocationError('This hub location changed in another session. Reloaded the latest pin; review it and try again.'); await load(); return }
      const result = formError(caught, 'We could not save the hub location. Try again.')
      setHubLocationError(result.message)
    } finally { setHubLocationSaving(false) }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordErrors({})
    setPasswordMessage(null)
    setPasswordSaving(true)
    try {
      const data = await request<{ message?: string }>('/api/v1/logistics/account/password', { method: 'PUT', body: JSON.stringify(password) })
      setPassword(emptyPassword)
      setPasswordMessage(data.message ?? 'Password updated successfully.')
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) { await logout().catch(() => undefined); navigate('/login', { replace: true }); return }
      const result = formError(caught, 'We could not update your password. Try again.')
      setPasswordErrors(result.errors)
      setPasswordMessage(result.message)
    } finally { setPasswordSaving(false) }
  }

  if (loading) return <div className="max-w-5xl p-5 sm:p-7"><div aria-label="Loading account settings" className="h-44 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" /></div>

  if (loadingError || !account) return <div className="max-w-2xl p-5 sm:p-7"><section className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300"><p>{loadingError ?? 'The account projection is unavailable.'}</p><button className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-current px-3 font-semibold" onClick={() => void load()} type="button"><FaArrowsRotate />Try again</button></section></div>

    const address = account.hub.address
  const hubAddress: HubAddress | undefined = address ? { addressLine1: address.address_line_1 ?? '', barangay: address.barangay ?? '', cityMunicipality: address.city_municipality ?? '', province: address.province ?? '', region: address.region ?? '', postalCode: address.postal_code ?? '', country: address.country ?? 'Philippines' } : undefined
  const initials = `${account.profile.first_name?.[0] ?? ''}${account.profile.last_name?.[0] ?? ''}` || 'L'

  return <div className="max-w-5xl space-y-5 p-5 sm:p-7">
    <div><h2 className="text-xl font-semibold">Account settings</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Maintain the approved Logistics account and the identity of its one operational hub. Email, approval status, and hub relocation are managed outside this screen.</p></div>

    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">Personal profile</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Only your profile fields can be changed here.</p></div><span className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-white/10">{account.status}</span></div>
      <div className="mt-5 flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-white/10 sm:flex-row sm:items-center">
        <LogisticsAvatar className="size-20" initials={initials} photoUrl={account.profile.profile_photo_url} />
        <form className="min-w-0 flex-1" onSubmit={(event) => void uploadPhoto(event)}>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Profile photo. JPEG, PNG, or WebP under 10 MB.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-semibold hover:bg-zinc-100 dark:border-white/15 dark:hover:bg-white/10"><FaCamera /><span>{photo ? 'Choose another' : 'Choose photo'}</span><input accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="sr-only" disabled={photoBusy} onChange={choosePhoto} type="file" /></label>
            {photo ? <span className="max-w-56 truncate text-sm text-zinc-500">{photo.name}</span> : null}
            <button className="h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3d0e54] disabled:cursor-not-allowed disabled:opacity-60" disabled={!photo || photoBusy} type="submit">{photoBusy ? `Uploading… ${photoProgress}%` : 'Upload'}</button>
            {account.profile.profile_photo_url ? <button className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-400/10" disabled={photoBusy} onClick={() => void removePhoto()} type="button"><FaTrashCan />Remove</button> : null}
          </div>
          {photoBusy ? <div aria-label={`Uploading profile photo: ${photoProgress}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={photoProgress} className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-white/10" role="progressbar"><div className="h-full bg-[#E6007A] transition-[width] duration-150" style={{ width: `${photoProgress}%` }} /></div> : null}
          {photoMessage ? <p className="mt-2 text-sm text-green-700 dark:text-green-300" role="status">{photoMessage}</p> : null}
          {photoError ? <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">{photoError}</p> : null}
        </form>
      </div>
      <form className="mt-5 space-y-5" onSubmit={(event) => void saveProfile(event)}>
        {profileMessage ? <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.04]" role="status">{profileMessage}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2"><Field error={errorFor(profileErrors, 'first_name')} id="first_name" label="First name" onChange={(event) => updateProfileField('first_name', event.target.value)} required value={profile.first_name} /><Field error={errorFor(profileErrors, 'last_name')} id="last_name" label="Last name" onChange={(event) => updateProfileField('last_name', event.target.value)} required value={profile.last_name} /><Field error={errorFor(profileErrors, 'middle_name')} id="middle_name" label="Middle name" onChange={(event) => updateProfileField('middle_name', event.target.value)} value={profile.middle_name} /><Field error={errorFor(profileErrors, 'contact_number')} id="contact_number" label="Contact number" onChange={(event) => updateProfileField('contact_number', event.target.value)} required value={profile.contact_number} /><SelectField error={errorFor(profileErrors, 'sex')} id="sex" label="Sex" onChange={(event) => updateProfileField('sex', event.target.value)} required value={profile.sex}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></SelectField><FlatpickrField error={errorFor(profileErrors, 'birth_date')} id="birth_date" label="Birth date" onChange={(value) => updateProfileField('birth_date', value)} options={{ dateFormat: 'Y-m-d', maxDate: new Date().toISOString().slice(0, 10) }} required value={profile.birth_date} /><Field disabled id="age" label="Age (calculated)" value={account.profile.age === null ? '' : String(account.profile.age)} /></div>
        <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3d0e54] disabled:cursor-not-allowed disabled:opacity-60" disabled={profileSaving} type="submit"><FaFloppyDisk />{profileSaving ? 'Saving…' : 'Save profile'}</button>
      </form>
    </section>

    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-6">
      <div><h3 className="font-semibold">Organization</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Update the organization label and the display name of its sole hub.</p></div>
      <form className="mt-5 space-y-5" onSubmit={(event) => void saveOrganization(event)}>
        {organizationMessage ? <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.04]" role="status">{organizationMessage}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2"><Field error={errorFor(organizationErrors, 'business_name')} id="business_name" label="Business name" onChange={(event) => setOrganization((current) => ({ ...current, business_name: event.target.value }))} required value={organization.business_name} /><Field error={errorFor(organizationErrors, 'hub_name')} id="hub_name" label="Operational hub name" onChange={(event) => setOrganization((current) => ({ ...current, hub_name: event.target.value }))} required value={organization.hub_name} /></div>
        <button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3d0e54] disabled:cursor-not-allowed disabled:opacity-60" disabled={organizationSaving} type="submit"><FaFloppyDisk />{organizationSaving ? 'Saving…' : 'Save organization'}</button>
      </form>
    </section>

    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-6">
      <div><h3 className="font-semibold">Operational hub</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">This is the approved address for the sole operational hub/sorting center. Text relocation requires a separate review; this screen only corrects the pin on the same premises.</p></div>
      {address ? <><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-zinc-500">Address line</dt><dd className="mt-1 font-medium">{[address.address_line_1, address.address_line_2].filter(Boolean).join(', ') || '—'}</dd></div><div><dt className="text-zinc-500">Barangay</dt><dd className="mt-1 font-medium">{address.barangay || '—'}</dd></div><div><dt className="text-zinc-500">City / municipality</dt><dd className="mt-1 font-medium">{address.city_municipality || '—'}</dd></div><div><dt className="text-zinc-500">Province / region</dt><dd className="mt-1 font-medium">{[address.province, address.region].filter(Boolean).join(', ') || '—'}</dd></div><div><dt className="text-zinc-500">Postal code</dt><dd className="mt-1 font-medium">{address.postal_code || '—'}</dd></div><div><dt className="text-zinc-500">Country</dt><dd className="mt-1 font-medium">{address.country || '—'}</dd></div></dl><div className="mt-6 border-t border-zinc-200 pt-5 dark:border-white/10"><form className="space-y-4" onSubmit={(event) => void saveHubLocation(event)}><div><h4 className="font-semibold">Hub map pin</h4><p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Review or correct the exact entrance. A reason is required and the server rejects stale edits.</p></div><HubLocationPicker address={hubAddress} apiKey={geoapifyApiKey} confirmed={hubLocationConfirmed} latitude={hubLocation?.latitude ?? null} longitude={hubLocation?.longitude ?? null} onChange={(coordinates) => { setHubLocation(coordinates); setHubLocationConfirmed(false); setHubLocationMessage(null) }} onConfirm={() => { setHubLocationConfirmed(true); setHubLocationMessage(null) }} /><label className="block text-sm font-medium" htmlFor="hub-location-reason">Reason for same-premises correction *<textarea className="mt-1 min-h-24 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#E6007A] focus:ring-2 focus:ring-pink-500/15 dark:border-white/15 dark:bg-[#171719]" id="hub-location-reason" maxLength={2000} onChange={(event) => setHubLocationReason(event.target.value)} placeholder="Example: corrected the pin to the loading entrance." required value={hubLocationReason} /></label>{hubLocationError ? <p className="text-sm text-red-700 dark:text-red-300" role="alert">{hubLocationError}</p> : null}{hubLocationMessage ? <p className="text-sm text-green-700 dark:text-green-300" role="status">{hubLocationMessage}</p> : null}<button className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3d0e54] disabled:cursor-not-allowed disabled:opacity-60" disabled={hubLocationSaving || !hubLocation || !hubLocationConfirmed} type="submit"><FaFloppyDisk />{hubLocationSaving ? 'Saving…' : 'Save hub pin'}</button></form></div></> : <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300">The approved hub address is unavailable. Contact an administrator before using Logistics operations.</p>}
    </section>

    <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b] sm:p-6">
      <div className="flex items-start gap-3"><span className="mt-0.5 text-[#4C1268] dark:text-pink-300"><FaLock /></span><div><h3 className="font-semibold">Security</h3><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Email changes and multi-factor authentication are not part of this release.</p></div></div>
      <form className="mt-5 space-y-5" onSubmit={(event) => void savePassword(event)}>
        {passwordMessage ? <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.04]" role="status">{passwordMessage}</p> : null}
        <Field disabled id="email" label="Email address" value={account.email} />
        <div className="grid gap-4 sm:grid-cols-2"><Field autoComplete="current-password" error={errorFor(passwordErrors, 'current_password')} id="current_password" label="Current password" onChange={(event) => setPassword((current) => ({ ...current, current_password: event.target.value }))} required type="password" value={password.current_password} /><div /></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field autoComplete="new-password" error={errorFor(passwordErrors, 'password')} id="password" label="New password" minLength={8} onChange={(event) => setPassword((current) => ({ ...current, password: event.target.value }))} required type="password" value={password.password} /><Field autoComplete="new-password" error={errorFor(passwordErrors, 'password_confirmation')} id="password_confirmation" label="Confirm new password" minLength={8} onChange={(event) => setPassword((current) => ({ ...current, password_confirmation: event.target.value }))} required type="password" value={password.password_confirmation} /></div>
        <p className="text-xs text-zinc-500">Use at least 8 characters with uppercase, lowercase, and a number. Changing the password signs out other API sessions.</p>
        <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 px-4 text-sm font-semibold hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/10" disabled={passwordSaving} type="submit"><FaLock />{passwordSaving ? 'Updating…' : 'Update password'}</button>
      </form>
    </section>
  </div>
}
