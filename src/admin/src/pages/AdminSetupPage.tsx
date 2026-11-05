import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PortalButton, PortalField } from '@aisley/ui/portal'
import { useAuth } from '../auth/useAuth'
import { ThemeToggle } from '../components/ThemeToggle'
import { ApiError } from '../lib/api'
import { completeAdminSetup, requestSetupCode } from '../lib/adminAccounts'
import type { SetupChallenge } from '../types/adminAccounts'

export function AdminSetupPage() {
  const { admin, updateAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<SetupChallenge | null>(null)
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    document.title = 'Complete Admin setup | Aisley'
  }, [])
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!admin) return null
  if (!admin.setup_required) return <Navigate replace to="/dashboard" />
  const cooldown = challenge
    ? Math.max(0, Math.ceil((Date.parse(challenge.resend_available_at) - now) / 1000))
    : 0
  const expired = challenge && Date.parse(challenge.expires_at) <= now
  const draft = {
    current_password: current,
    ...(admin.password_change_required ? { password, password_confirmation: confirmation } : {}),
  }

  async function submit(event?: FormEvent, resend = false) {
    event?.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setErrors({})
    try {
      if (!challenge || resend) {
        const response = await requestSetupCode(draft)
        setChallenge(response.data)
        setCode('')
        setNow(Date.now())
      } else {
        const response = await completeAdminSetup({
          ...draft,
          challenge_id: challenge.challenge_id,
          verification_code: code,
        })
        setCurrent('')
        setPassword('')
        setConfirmation('')
        setCode('')
        updateAdmin(response.admin)
        navigate('/dashboard', { replace: true })
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to complete setup. Please try again.',
      )
      if (caught instanceof ApiError) setErrors(caught.errors)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      className="portal-shell grid min-h-screen place-items-center p-4 sm:p-8"
      data-role="admin"
    >
      <section className="portal-panel w-full max-w-xl p-5 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <span className="font-semibold">AISLEY Admin</span>
          <ThemeToggle />
        </div>
        <h1 className="text-2xl font-semibold">
          {admin.password_change_required ? 'Set up your account' : 'Verify your email'}
        </h1>
        <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-300">{admin.email}</p>
        <p className="my-5 text-sm">
          {admin.password_change_required
            ? 'Choose your own password and verify your email before continuing.'
            : 'Verify your updated email address before continuing.'}
        </p>
        <form className="space-y-5" onSubmit={(event) => void submit(event)}>
          <fieldset className="space-y-4" disabled={busy || Boolean(challenge)}>
            <PortalField
              label={admin.password_change_required ? 'Temporary password' : 'Current password'}
              type="password"
              autoComplete="current-password"
              required
              value={current}
              error={errors.current_password?.[0]}
              onChange={(event) => setCurrent(event.target.value)}
            />
            {admin.password_change_required && (
              <>
                <PortalField
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  hint="At least 8 characters, including uppercase, lowercase and a number."
                  error={errors.password?.[0]}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <PortalField
                  label="Confirm new password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmation}
                  error={errors.password_confirmation?.[0]}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </>
            )}
          </fieldset>
          {challenge && (
            <section className="space-y-4" aria-label="Email verification">
              <p role="status" className="text-sm">
                Code requested for {challenge.masked_email}. Check your inbox; delivery may take a
                moment.
              </p>
              <PortalField
                label="Verification code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                error={errors.verification_code?.[0]}
                onChange={(event) => setCode(event.target.value)}
                disabled={busy}
              />
              {expired && <p role="status">This code has expired. Request another code.</p>}
              <div className="flex flex-wrap gap-3">
                <PortalButton
                  disabled={busy || cooldown > 0}
                  onClick={() => void submit(undefined, true)}
                >
                  {cooldown ? `Resend in ${cooldown}s` : 'Resend code'}
                </PortalButton>
                <PortalButton
                  disabled={busy}
                  onClick={() => {
                    setChallenge(null)
                    setCode('')
                    setError('')
                    setErrors({})
                  }}
                >
                  Edit password details
                </PortalButton>
              </div>
            </section>
          )}
          {error && (
            <p className="text-sm text-red-700 dark:text-red-300" role="alert">
              {error}
            </p>
          )}
          <PortalButton
            type="submit"
            variant="primary"
            isLoading={busy}
            disabled={Boolean(expired)}
          >
            {challenge ? 'Verify and continue' : 'Send verification code'}
          </PortalButton>
        </form>
        <PortalButton className="mt-5" disabled={busy} onClick={() => void logout()}>
          Sign out
        </PortalButton>
      </section>
    </main>
  )
}
