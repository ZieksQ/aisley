import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaCircleCheck, FaCircleExclamation } from 'react-icons/fa6'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { FormField } from '../components/FormField'
import { LoadingScreen } from '../components/LoadingScreen'
import { ApiError, apiRequest, initializeCsrf } from '../lib/api'

type MessageResponse = { message: string }

export function ForgotPasswordPage() {
  const { seller, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Reset Seller password | Aisley'
  }, [])

  if (isLoading) return <LoadingScreen />
  if (seller) return <Navigate replace to="/dashboard" />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSubmitting(true)

    try {
      await initializeCsrf()
      const response = await apiRequest<MessageResponse>('/api/v1/seller/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setMessage(response.message)
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.errors.email?.[0] ?? caughtError.message)
      } else {
        setError('We could not reach the API. Check that it is running and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      description="Enter the email used for your Seller account."
      footer={<Link className="font-semibold text-[#b0005d] hover:underline dark:text-pink-400" to="/login">Return to sign in</Link>}
      title="Forgot your password?"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormField
          autoComplete="email"
          autoFocus
          id="email"
          label="Email address"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />

        {message ? (
          <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300" role="status">
            <FaCircleCheck aria-hidden="true" className="mt-0.5 shrink-0" />
            <p>{message}</p>
          </div>
        ) : null}
        {error ? (
          <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-300" role="alert">
            <FaCircleExclamation aria-hidden="true" className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        <button
          className="h-11 w-full rounded-lg bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#c9006b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Sending instructions…' : 'Send reset instructions'}
        </button>
      </form>
    </AuthShell>
  )
}
