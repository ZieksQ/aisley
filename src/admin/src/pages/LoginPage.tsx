import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { FaArrowRight, FaEye, FaEyeSlash, FaLock, FaShieldHalved } from 'react-icons/fa6'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { LoadingScreen } from '../components/LoadingScreen'
import { ThemeToggle } from '../components/ThemeToggle'
import { ApiError } from '../lib/api'

type LocationState = { from?: string }

export function LoginPage() {
  const { admin, isLoading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Admin sign in | Aisley'
  }, [])

  if (isLoading) return <LoadingScreen />
  if (admin) return <Navigate replace to="/dashboard" />

  const destination = (location.state as LocationState | null)?.from ?? '/dashboard'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login({ email, password, remember })
      navigate(destination, { replace: true })
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.errors.email?.[0] ?? caughtError.message)
      } else {
        setError('We could not reach the server. Check your connection and try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950 dark:bg-[#0b0d13] dark:text-white">
      <div className="absolute right-5 top-5 z-10 sm:right-8 sm:top-8">
        <ThemeToggle />
      </div>

      <div className="grid min-h-screen lg:grid-cols-[minmax(360px,0.9fr)_1.1fr]">
        <section className="relative hidden overflow-hidden bg-[#240d30] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="absolute -left-24 top-1/4 size-80 rounded-full bg-[#E6007A]/15 blur-3xl" />
          <div className="absolute -right-24 bottom-10 size-96 rounded-full bg-violet-500/15 blur-3xl" />

          <div className="relative flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <FaShieldHalved aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Aisley</p>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-purple-200/70">Admin Console</p>
            </div>
          </div>

          <div className="relative max-w-xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-pink-300">Platform operations</p>
            <h1 className="text-4xl font-semibold leading-tight tracking-[-0.035em] xl:text-5xl">
              A clear view of everything that keeps Aisley moving.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-purple-100/65">
              Review access, monitor marketplace activity, and manage platform operations from one secure workspace.
            </p>
          </div>

          <p className="relative text-xs text-purple-100/45">Authorized administrators only</p>
        </section>

        <section className="flex items-center justify-center px-5 py-24 sm:px-10 lg:py-12">
          <div className="w-full max-w-md">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="grid size-11 place-items-center rounded-2xl bg-[#4C1268] text-white shadow-lg shadow-purple-950/20">
                <FaShieldHalved aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold">Aisley</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Admin Console</p>
              </div>
            </div>

            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold text-[#E6007A]">Welcome back</p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em]">Sign in to your account</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Enter your administrator credentials to continue.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-semibold" htmlFor="email">Email address</label>
                <input
                  autoComplete="email"
                  autoFocus
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none placeholder:text-slate-400 focus:border-[#E6007A] focus:ring-4 focus:ring-pink-500/10 dark:border-white/10 dark:bg-white/5 dark:focus:border-pink-500"
                  id="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@aisley.com"
                  required
                  type="email"
                  value={email}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold" htmlFor="password">Password</label>
                <div className="relative">
                  <input
                    autoComplete="current-password"
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 pr-12 text-sm outline-none placeholder:text-slate-400 focus:border-[#E6007A] focus:ring-4 focus:ring-pink-500/10 dark:border-white/10 dark:bg-white/5 dark:focus:border-pink-500"
                    id="password"
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#E6007A] dark:hover:text-white"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <label className="flex w-fit items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <input
                  checked={remember}
                  className="size-4 rounded border-slate-300 accent-[#E6007A]"
                  onChange={(event) => setRemember(event.target.checked)}
                  type="checkbox"
                />
                Keep me signed in
              </label>

              {error && (
                <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300" role="alert">
                  <FaLock aria-hidden="true" className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <button
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#E6007A] px-5 text-sm font-semibold text-white shadow-lg shadow-pink-700/15 hover:bg-[#cc006d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? 'Signing in…' : 'Sign in securely'}
                {!isSubmitting && <FaArrowRight aria-hidden="true" />}
              </button>
            </form>

            <p className="mt-8 text-center text-xs leading-5 text-slate-400 dark:text-slate-500">
              Access is logged and monitored for platform security.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
