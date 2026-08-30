import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaCircleExclamation } from 'react-icons/fa6'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { AuthShell } from '../components/AuthShell'
import { FormField } from '../components/FormField'
import { LoadingScreen } from '../components/LoadingScreen'
import { ApiError, readableAuthError } from '../lib/api'

type LocationState = { from?: string; notice?: string }

export function LoginPage() {
  const { seller, isLoading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as LocationState | null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Seller sign in | Aisley'
  }, [])

  if (isLoading) return <LoadingScreen />
  if (seller) return <Navigate replace to="/dashboard" />

  const destination = state?.from?.startsWith('/') ? state.from : '/dashboard'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login({ email, password, remember })
      navigate(destination, { replace: true })
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(readableAuthError(caughtError))
      } else {
        setError('We could not reach the API. Check that it is running and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      description="Use an approved, active Seller account to continue."
      footer={<p>New to Aisley? <Link className="font-semibold text-[#b0005d] hover:underline dark:text-pink-400" to="/register">Apply for a Seller account</Link></p>}
      title="Sign in to Seller"
    >
      {state?.notice ? (
        <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300" role="status">
          {state.notice}
        </p>
      ) : null}

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
        <FormField
          autoComplete="current-password"
          id="password"
          label="Password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <label className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
            <input
              checked={remember}
              className="size-4 accent-[#E6007A]"
              onChange={(event) => setRemember(event.target.checked)}
              type="checkbox"
            />
            Keep me signed in
          </label>
          <Link className="font-medium text-[#b0005d] hover:underline dark:text-pink-400" to="/forgot-password">Forgot password?</Link>
        </div>

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
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
