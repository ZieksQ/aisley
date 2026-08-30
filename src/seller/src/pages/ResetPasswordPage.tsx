import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaCircleCheck, FaCircleExclamation } from 'react-icons/fa6'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { FormField } from '../components/FormField'
import { LoadingScreen } from '../components/LoadingScreen'
import { ApiError, apiRequest, initializeCsrf } from '../lib/api'

type MessageResponse = { message: string }

export function ResetPasswordPage() {
  const { seller, isLoading } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Choose a new Seller password | Aisley'
  }, [])

  if (isLoading) return <LoadingScreen />
  if (seller) return <Navigate replace to="/dashboard" />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors({})
    setFormError(null)
    setIsSubmitting(true)

    const form = new FormData(event.currentTarget)

    try {
      await initializeCsrf()
      await apiRequest<MessageResponse>('/api/v1/seller/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email,
          token,
          password: String(form.get('password') ?? ''),
          password_confirmation: String(form.get('password_confirmation') ?? ''),
        }),
      })
      setIsComplete(true)
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

  if (!token || !email) {
    return (
      <AuthShell
        description="This reset URL is missing the information needed to continue."
        footer={<Link className="font-semibold text-[#b0005d] hover:underline dark:text-pink-400" to="/login">Return to sign in</Link>}
        title="Invalid reset link"
      >
        <Link className="inline-flex h-11 items-center rounded-lg bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#c9006b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]" to="/forgot-password">
          Request a new link
        </Link>
      </AuthShell>
    )
  }

  if (isComplete) {
    return (
      <AuthShell
        description="Your Seller password has been updated."
        title="Password reset complete"
      >
        <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">
          <FaCircleCheck aria-hidden="true" className="mt-0.5 shrink-0" />
          <p>You can now sign in with your new password.</p>
        </div>
        <Link className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#c9006b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]" to="/login">
          Continue to sign in
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      description={`Set a new password for ${email}.`}
      footer={<Link className="font-semibold text-[#b0005d] hover:underline dark:text-pink-400" to="/forgot-password">Request another link</Link>}
      title="Choose a new password"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormField autoComplete="new-password" error={errors.password?.[0]} id="password" label="New password" minLength={8} name="password" required type="password" />
        <FormField autoComplete="new-password" id="password_confirmation" label="Confirm new password" minLength={8} name="password_confirmation" required type="password" />
        <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">Use at least 8 characters with uppercase, lowercase, and a number.</p>

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
          {isSubmitting ? 'Updating password…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  )
}
