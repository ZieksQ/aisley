import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaCircleCheck, FaCircleExclamation } from 'react-icons/fa6'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { FormField, SelectField } from '../components/FormField'
import { LoadingScreen } from '../components/LoadingScreen'
import { ApiError, apiRequest, initializeCsrf } from '../lib/api'
import type { AuthResponse, RegistrationPayload } from '../types/auth'

export function RegisterPage() {
  const { seller, isLoading } = useAuth()
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Seller registration | Aisley'
  }, [])

  if (isLoading) return <LoadingScreen />
  if (seller) return <Navigate replace to="/dashboard" />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    setFormError(null)
    setIsSubmitting(true)

    const form = new FormData(event.currentTarget)
    const middleName = String(form.get('middle_name') ?? '').trim()
    const payload: RegistrationPayload = {
      first_name: String(form.get('first_name') ?? ''),
      last_name: String(form.get('last_name') ?? ''),
      middle_name: middleName || null,
      contact_number: String(form.get('contact_number') ?? ''),
      sex: String(form.get('sex') ?? '') as RegistrationPayload['sex'],
      birth_date: String(form.get('birth_date') ?? ''),
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      password_confirmation: String(form.get('password_confirmation') ?? ''),
    }

    try {
      await initializeCsrf()
      const response = await apiRequest<AuthResponse>('/api/v1/seller/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
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

  if (submittedEmail) {
    return (
      <AuthShell
        description="Your account exists, but it cannot access Seller tools until an Admin approves it."
        footer={<Link className="font-semibold text-[#b0005d] hover:underline dark:text-pink-400" to="/login">Return to sign in</Link>}
        title="Application submitted"
      >
        <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">
          <FaCircleCheck aria-hidden="true" className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Waiting for Admin approval</p>
            <p className="mt-1 text-sm leading-6">We will send the decision to {submittedEmail}. You can sign in after the account becomes active.</p>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      description="Provide the account holder’s details. Shop setup and business documents are not collected in this step."
      footer={<p>Already registered? <Link className="font-semibold text-[#b0005d] hover:underline dark:text-pink-400" to="/login">Sign in</Link></p>}
      title="Apply for a Seller account"
      wide
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <fieldset>
          <legend className="mb-4 font-semibold">Personal information</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField error={errors.first_name?.[0]} id="first_name" label="First name" name="first_name" required />
            <FormField error={errors.last_name?.[0]} id="last_name" label="Last name" name="last_name" required />
            <FormField error={errors.middle_name?.[0]} id="middle_name" label="Middle name (optional)" name="middle_name" />
            <FormField error={errors.contact_number?.[0]} id="contact_number" label="Contact number" name="contact_number" required type="tel" />
            <SelectField defaultValue="" error={errors.sex?.[0]} id="sex" label="Sex" name="sex" required>
              <option disabled value="">Select an option</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </SelectField>
            <FormField error={errors.birth_date?.[0]} id="birth_date" label="Birth date" name="birth_date" required type="date" />
          </div>
        </fieldset>

        <fieldset className="border-t border-zinc-200 pt-6 dark:border-white/10">
          <legend className="mb-4 font-semibold">Sign-in details</legend>
          <div className="space-y-4">
            <FormField autoComplete="email" error={errors.email?.[0]} id="register_email" label="Email address" name="email" required type="email" />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField autoComplete="new-password" error={errors.password?.[0]} id="register_password" label="Password" minLength={8} name="password" required type="password" />
              <FormField autoComplete="new-password" id="password_confirmation" label="Confirm password" minLength={8} name="password_confirmation" required type="password" />
            </div>
            <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">Use at least 8 characters with uppercase, lowercase, and a number.</p>
          </div>
        </fieldset>

        {formError ? (
          <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300" role="alert">
            <FaCircleExclamation aria-hidden="true" className="mt-0.5 shrink-0" />
            <p>{formError}</p>
          </div>
        ) : null}

        <button
          className="h-11 w-full rounded-lg bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#c9006b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Submitting application…' : 'Submit application'}
        </button>
      </form>
    </AuthShell>
  )
}
