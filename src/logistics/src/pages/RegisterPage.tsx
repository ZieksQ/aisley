import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthShell } from '../components/AuthShell'
import { Field, SelectField } from '../components/Field'
import { FlatpickrField } from '../components/FlatpickrInput'
import { HubLocationPicker, type HubAddress, type HubCoordinates } from '../components/HubLocationPicker'
import { PsgcAddressFields } from '../components/PsgcAddressFields'
import { ApiError, csrf, request } from '../lib/api'

function fieldValue(form: HTMLFormElement, name: string): string {
  return String(new FormData(form).get(name) ?? '')
}

export function RegisterPage() {
  const navigate = useNavigate()
  const formRef = useRef<HTMLFormElement>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [birthDate, setBirthDate] = useState('')
  const [hubPin, setHubPin] = useState<HubCoordinates | null>(null)
  const [pinConfirmed, setPinConfirmed] = useState(false)
  const age = birthDate ? Math.max(0, Math.floor((Date.now() - new Date(birthDate).getTime()) / 31557600000)) : null
  const geoapifyApiKey = import.meta.env.GEOAPIFY_API_KEY ?? ''

  useEffect(() => { document.title = 'Apply for Logistics | Aisley' }, [])

  function addressFromForm(): HubAddress {
    const form = formRef.current
    return {
      addressLine1: form ? fieldValue(form, 'address[address_line_1]') : '',
      barangay: form ? fieldValue(form, 'address[barangay]') : '',
      cityMunicipality: form ? fieldValue(form, 'address[city_municipality]') : '',
      province: form ? fieldValue(form, 'address[province]') : '',
      region: form ? fieldValue(form, 'address[region]') : '',
      postalCode: form ? fieldValue(form, 'address[postal_code]') : '',
      country: 'Philippines',
    }
  }

  function handleAddressInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) {
      if (target.name.startsWith('address[') || target.id.endsWith('-select') || ['line1', 'line2', 'postal'].includes(target.id)) {
        setHubPin(null)
        setPinConfirmed(false)
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    setError(null)
    setSubmitting(true)
    try {
      await csrf()
      const form = new FormData(event.currentTarget)
      if (hubPin && pinConfirmed) {
        form.append('latitude', String(hubPin.latitude))
        form.append('longitude', String(hubPin.longitude))
      }
      const result = await request<{ message: string }>('/api/v1/logistics/auth/register', { method: 'POST', body: form })
      navigate('/login', { replace: true, state: { notice: result.message } })
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.errors)
        setError(caught.code === 'EMAIL_ALREADY_REGISTERED' ? caught.message : Object.keys(caught.errors).length ? 'Please correct the highlighted fields.' : caught.message)
      } else setError('We could not reach the API. Check that it is running and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return <AuthShell description="Submit one organization account and its sole operational hub for Admin review. Fields marked * are required." footer={<p>Already applied? <Link className="font-semibold text-[#b0005d] hover:underline" to="/login">Sign in</Link></p>} title="Apply for Logistics" wide>
    <form className="space-y-7" onInput={handleAddressInput} onSubmit={submit} ref={formRef}>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300" role="alert">{error}</p> : null}
      <fieldset><legend className="mb-4 text-base font-semibold">Account holder</legend><div className="grid gap-4 sm:grid-cols-2"><Field error={errors.first_name?.[0]} id="first_name" label="First name *" name="first_name" required /><Field error={errors.last_name?.[0]} id="last_name" label="Last name *" name="last_name" required /><Field error={errors.middle_name?.[0]} id="middle_name" label="Middle initial" maxLength={1} name="middle_name" /><SelectField error={errors.sex?.[0]} id="sex" label="Sex *" name="sex" required><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option></SelectField><Field error={errors.contact_number?.[0]} id="contact" label="Contact number *" name="contact_number" required /><FlatpickrField error={errors.birth_date?.[0]} id="birth_date" label="Birthday *" name="birth_date" onChange={setBirthDate} options={{ dateFormat: 'Y-m-d', maxDate: new Date().toISOString().slice(0, 10) }} required value={birthDate} /><Field disabled id="age" label="Age (calculated)" value={age === null ? '' : String(age)} /></div></fieldset>
      <fieldset><legend className="mb-4 text-base font-semibold">Organization</legend><Field error={errors.business_name?.[0]} id="business" label="Business name *" name="business_name" required /></fieldset>
      <fieldset><legend className="mb-4 text-base font-semibold">Operational hub/sorting-center address</legend><div className="grid gap-4 sm:grid-cols-2"><PsgcAddressFields errors={errors} /></div><div className="mt-6 border-t border-zinc-200 pt-5 dark:border-white/10"><HubLocationPicker apiKey={geoapifyApiKey} confirmed={pinConfirmed} getAddress={addressFromForm} latitude={hubPin?.latitude ?? null} longitude={hubPin?.longitude ?? null} onChange={(coordinates) => { setHubPin(coordinates); setPinConfirmed(false) }} onConfirm={() => setPinConfirmed(true)} /></div></fieldset>
      <fieldset><legend className="mb-4 text-base font-semibold">Credentials and evidence</legend><div className="grid gap-4 sm:grid-cols-2"><Field autoComplete="email" error={errors.email?.[0]} id="email" label="Email address *" name="email" required type="email" /><Field autoComplete="new-password" error={errors.password?.[0]} id="password" label="Password *" minLength={8} name="password" required type="password" /><Field autoComplete="new-password" error={errors.password_confirmation?.[0]} id="password_confirmation" label="Confirm password *" minLength={8} name="password_confirmation" required type="password" /><Field accept="image/jpeg,image/png,image/webp" error={errors.government_id?.[0]} id="government_id" label="Government ID * (JPG, PNG, or WebP; under 10 MB)" name="government_id" required type="file" /><Field accept="image/jpeg,image/png,image/webp" error={errors.business_permit?.[0]} id="business_permit" label="Business/DTI permit * (JPG, PNG, or WebP; under 10 MB)" name="business_permit" required type="file" /></div></fieldset>
      <button className="h-11 rounded-lg bg-[#4C1268] px-5 text-sm font-semibold text-white hover:bg-[#3d0e54] disabled:opacity-60" disabled={submitting} type="submit">{submitting ? 'Submitting application…' : 'Submit for approval'}</button>
    </form>
  </AuthShell>
}
