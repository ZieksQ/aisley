import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FaCircleCheck, FaCircleExclamation } from 'react-icons/fa6'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { FormField, SelectField } from '../components/FormField'
import { GeoapifyAddressField } from '../components/GeoapifyAddressField'
import type { GeoapifySuggestion } from '../components/GeoapifyAddressField'
import { LoadingScreen } from '../components/LoadingScreen'
import { ApiError, apiRequest, initializeCsrf } from '../lib/api'
import type { AuthResponse, RegistrationOptionsResponse, ShopCategoryOption } from '../types/auth'

function ageFromBirthDate(birthDate: string): number | null {
  if (!birthDate) return null
  const birth = new Date(`${birthDate}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (today.getMonth() < birth.getMonth()
    || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1

  return age >= 0 ? age : null
}

export function RegisterPage() {
  const { seller, isLoading } = useAuth()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [birthDate, setBirthDate] = useState('')
  const [shopCategories, setShopCategories] = useState<ShopCategoryOption[]>([])
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [address, setAddress] = useState({ barangay: '', cityMunicipality: '', province: '', region: '', postalCode: '' })
  const [provincePlaceId, setProvincePlaceId] = useState<string | null>(null)
  const [municipalityPlaceId, setMunicipalityPlaceId] = useState<string | null>(null)
  const age = useMemo(() => ageFromBirthDate(birthDate), [birthDate])
  const geoapifyApiKey = (import.meta.env.VITE_GEOAPIFY_API_KEY ?? '').trim()

  useEffect(() => {
    document.title = 'Seller registration | Aisley'
    const controller = new AbortController()

    apiRequest<RegistrationOptionsResponse>('/api/v1/seller/auth/registration-options', { signal: controller.signal })
      .then((response) => setShopCategories(response.shop_categories))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setOptionsError(error instanceof Error ? error.message : 'Shop categories could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingOptions(false)
      })

    return () => controller.abort()
  }, [])

  if (isLoading) return <LoadingScreen />
  if (seller) return <Navigate replace to="/dashboard" />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    setFormError(null)
    setIsSubmitting(true)

    try {
      const formData = new FormData(event.currentTarget)
      await initializeCsrf()
      const response = await apiRequest<AuthResponse>('/api/v1/seller/auth/register', {
        method: 'POST',
        body: formData,
      })
      setSubmittedEmail(response.seller.email)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setErrors(caughtError.errors)
        setFormError(caughtError.message)
      } else {
        setFormError('We could not reach the API. Check that it is running and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function selectProvince(suggestion: GeoapifySuggestion) {
    setProvincePlaceId(suggestion.placeId)
    setMunicipalityPlaceId(null)
    setAddress((current) => ({
      ...current,
      province: suggestion.value,
      region: suggestion.region ?? current.region,
      postalCode: suggestion.postcode ?? current.postalCode,
      cityMunicipality: '',
      barangay: '',
    }))
  }

  function selectMunicipality(suggestion: GeoapifySuggestion) {
    setMunicipalityPlaceId(suggestion.placeId)
    setAddress((current) => ({
      ...current,
      cityMunicipality: suggestion.value,
      province: suggestion.province ?? current.province,
      region: suggestion.region ?? current.region,
      postalCode: suggestion.postcode ?? current.postalCode,
      barangay: '',
    }))
  }

  function selectBarangay(suggestion: GeoapifySuggestion) {
    setAddress((current) => ({
      ...current,
      barangay: suggestion.value,
      cityMunicipality: suggestion.city ?? current.cityMunicipality,
      province: suggestion.province ?? current.province,
      region: suggestion.region ?? current.region,
      postalCode: suggestion.postcode ?? current.postalCode,
    }))
  }

  if (submittedEmail) {
    return (
      <AuthShell
        description="Your account and shop cannot access Seller tools until an Admin verifies the application."
        footer={<Link className="font-semibold text-[#b0005d] hover:underline dark:text-pink-400" to="/login">Return to sign in</Link>}
        title="Application submitted"
      >
        <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">
          <FaCircleCheck aria-hidden="true" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Waiting for Admin approval</p>
            <p className="mt-1 text-sm leading-6">We will send the decision to {submittedEmail}. You can sign in after the account and shop become active.</p>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      description="Enter the account holder, business, address, and verification details required for Admin review."
      footer={<p>Already registered? <Link className="font-semibold text-[#b0005d] hover:underline dark:text-pink-400" to="/login">Sign in</Link></p>}
      title="Apply for a Seller account"
      wide
    >
      <form className="space-y-7" encType="multipart/form-data" onSubmit={handleSubmit}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Fields marked with * are required.</p>

        <fieldset>
          <legend className="mb-4 font-semibold">Personal information</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField error={errors.first_name?.[0]} id="first_name" label="First name *" name="first_name" required />
            <FormField error={errors.last_name?.[0]} id="last_name" label="Last name *" name="last_name" required />
            <FormField error={errors.middle_name?.[0]} id="middle_name" label="Middle initial (optional)" maxLength={1} name="middle_name" />
            <FormField error={errors.contact_number?.[0]} id="contact_number" label="Contact number *" name="contact_number" required type="tel" />
            <SelectField defaultValue="" error={errors.sex?.[0]} id="sex" label="Sex *" name="sex" required>
              <option disabled value="">Select an option</option>
              <option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option><option value="prefer_not_to_say">Prefer not to say</option>
            </SelectField>
            <FormField error={errors.birth_date?.[0]} id="birth_date" label="Birth date *" name="birth_date" onChange={(event) => setBirthDate(event.target.value)} required type="date" value={birthDate} />
            <div>
              <span className="mb-1.5 block text-sm font-medium">Age</span>
              <output className="flex h-11 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300" htmlFor="birth_date">
                {age === null ? 'Calculated from birth date' : `${age} years old`}
              </output>
            </div>
          </div>
        </fieldset>

        <fieldset className="border-t border-zinc-200 pt-6 dark:border-white/10">
          <legend className="mb-4 font-semibold">Business information</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField error={errors.business_name?.[0]} id="business_name" label="Business name *" name="business_name" required />
            <SelectField defaultValue="" disabled={isLoadingOptions || Boolean(optionsError)} error={errors.shop_category_id?.[0] ?? optionsError ?? undefined} id="shop_category_id" label="Line of business *" name="shop_category_id" required>
              <option disabled value="">{isLoadingOptions ? 'Loading categories…' : 'Select a shop category'}</option>
              {shopCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </SelectField>
          </div>
        </fieldset>

        <fieldset className="border-t border-zinc-200 pt-6 dark:border-white/10">
          <legend className="mb-1 font-semibold">Business address</legend>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">Choose a suggested Province, Municipality, and Barangay when available. Street and building details remain manual, and every address field stays editable.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField error={errors['address.address_line_1']?.[0]} id="address_line_1" label="Street and house/building number *" name="address[address_line_1]" required />
            <FormField error={errors['address.address_line_2']?.[0]} id="address_line_2" label="Unit, floor, or landmark (optional)" name="address[address_line_2]" />
            <GeoapifyAddressField apiKey={geoapifyApiKey} error={errors['address.province']?.[0]} id="province" kind="province" label="Province *" name="address[province]" onChange={(value) => { setProvincePlaceId(null); setMunicipalityPlaceId(null); setAddress((current) => ({ ...current, province: value, cityMunicipality: '', barangay: '' })) }} onSelect={selectProvince} required value={address.province} />
            <GeoapifyAddressField apiKey={geoapifyApiKey} boundaryPlaceId={provincePlaceId} context={address.province} error={errors['address.city_municipality']?.[0]} id="city_municipality" kind="municipality" label="City or municipality *" name="address[city_municipality]" onChange={(value) => { setMunicipalityPlaceId(null); setAddress((current) => ({ ...current, cityMunicipality: value, barangay: '' })) }} onSelect={selectMunicipality} required value={address.cityMunicipality} />
            <GeoapifyAddressField apiKey={geoapifyApiKey} boundaryPlaceId={municipalityPlaceId ?? provincePlaceId} context={[address.cityMunicipality, address.province].filter(Boolean).join(', ')} error={errors['address.barangay']?.[0]} id="barangay" kind="barangay" label="Barangay *" name="address[barangay]" onChange={(value) => setAddress((current) => ({ ...current, barangay: value }))} onSelect={selectBarangay} required value={address.barangay} />
            <FormField error={errors['address.region']?.[0]} id="region" label="Region *" name="address[region]" onChange={(event) => setAddress((current) => ({ ...current, region: event.target.value }))} required value={address.region} />
            <FormField error={errors['address.postal_code']?.[0]} id="postal_code" label="Postal code *" maxLength={10} name="address[postal_code]" onChange={(event) => setAddress((current) => ({ ...current, postalCode: event.target.value }))} required value={address.postalCode} />
            <FormField disabled id="country" label="Country" name="country_display" value="Philippines" />
          </div>
          {!geoapifyApiKey ? <p className="mt-4 text-sm text-amber-700 dark:text-amber-300" role="status">Geoapify suggestions are not configured in this environment. You can still enter the complete address manually.</p> : null}
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">Suggestions powered by <a className="underline underline-offset-2" href="https://www.geoapify.com/" rel="noreferrer" target="_blank">Geoapify</a> and <a className="underline underline-offset-2" href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">© OpenStreetMap contributors</a>.</p>
        </fieldset>

        <fieldset className="border-t border-zinc-200 pt-6 dark:border-white/10">
          <legend className="mb-1 font-semibold">Verification documents</legend>
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">Upload JPEG, PNG, or WebP images smaller than 10 MB. Files remain private and are available only to authorized reviewers.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" error={errors.government_id?.[0]} id="government_id" label="Government-issued ID *" name="government_id" required type="file" />
            <FormField accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" error={errors.business_permit?.[0]} id="business_permit" label="Business permit *" name="business_permit" required type="file" />
          </div>
        </fieldset>

        <fieldset className="border-t border-zinc-200 pt-6 dark:border-white/10">
          <legend className="mb-4 font-semibold">Sign-in details</legend>
          <div className="space-y-4">
            <FormField autoComplete="email" error={errors.email?.[0]} id="register_email" label="Email address *" name="email" required type="email" />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField autoComplete="new-password" error={errors.password?.[0]} id="register_password" label="Password *" minLength={8} name="password" required type="password" />
              <FormField autoComplete="new-password" id="password_confirmation" label="Confirm password *" minLength={8} name="password_confirmation" required type="password" />
            </div>
            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">Use at least 8 characters with uppercase, lowercase, and a number.</p>
          </div>
        </fieldset>

        {formError ? <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300" role="alert"><FaCircleExclamation aria-hidden="true" className="mt-0.5 shrink-0" /><p>{formError}</p></div> : null}

        <button className="h-11 w-full rounded-lg bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#c9006b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60" disabled={isSubmitting || isLoadingOptions || Boolean(optionsError)} type="submit">
          {isSubmitting ? 'Submitting application…' : 'Submit application'}
        </button>
      </form>
    </AuthShell>
  )
}
