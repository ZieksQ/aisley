import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, TextField } from '@aisley/ui'
import { ApiError, apiOriginLabel, request } from './lib/api'
import { PickupOrders } from './PickupOrders'
import { PolicyConsentView, PolicyDocumentPanel } from './Policies'
import type {
  AccountResponse,
  CourierAccount,
  CourierDashboard,
  CourierUser,
  LoginResponse,
  MeResponse,
  PolicyConsentStatus,
  PolicyConsentStatusResponse,
  PolicyType,
} from './types'

const TOKEN_STORAGE_KEY = 'couriermockup.bearer_token'

type ProfileForm = {
  first_name: string
  middle_name: string
  last_name: string
  contact_number: string
}

type PasswordForm = {
  current_password: string
  password: string
  password_confirmation: string
}

const emptyProfile: ProfileForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  contact_number: '',
}

const emptyPassword: PasswordForm = {
  current_password: '',
  password: '',
  password_confirmation: '',
}

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

function profileFormFromAccount(account: CourierAccount): ProfileForm {
  return {
    first_name: account.profile.first_name ?? '',
    middle_name: account.profile.middle_name ?? '',
    last_name: account.profile.last_name ?? '',
    contact_number: account.profile.contact_number ?? '',
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message}${error.code ? ` (${error.code})` : ''}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'The request could not be completed.'
}

function fieldMessage(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.errors[field]?.[0] : undefined
}

function displayDate(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function App() {
  const [token, setToken] = useState<string | null>(readStoredToken)
  const [courier, setCourier] = useState<CourierUser | null>(null)
  const [account, setAccount] = useState<CourierAccount | null>(null)
  const [dashboard, setDashboard] = useState<CourierDashboard | null>(null)
  const [consentStatus, setConsentStatus] = useState<PolicyConsentStatus | null>(null)
  const [policyViewer, setPolicyViewer] = useState<PolicyType | null>(null)
  const [restoring, setRestoring] = useState(() => Boolean(readStoredToken()))
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile)
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPassword)
  const [profileError, setProfileError] = useState<unknown>(null)
  const [passwordError, setPasswordError] = useState<unknown>(null)

  const persistToken = useCallback((value: string | null) => {
    try {
      if (value) {
        sessionStorage.setItem(TOKEN_STORAGE_KEY, value)
      } else {
        sessionStorage.removeItem(TOKEN_STORAGE_KEY)
      }
    } catch {
      // The in-memory state still lets the mockup work if storage is unavailable.
    }

    setToken(value)
  }, [])

  const clearSession = useCallback(
    (message?: string) => {
      persistToken(null)
      setCourier(null)
      setAccount(null)
      setDashboard(null)
      setConsentStatus(null)
      setPolicyViewer(null)
      setRestoring(false)
      setProfileForm(emptyProfile)
      setPasswordForm(emptyPassword)
      setProfileError(null)
      setPasswordError(null)
      if (message) {
        setAuthError(message)
      }
    },
    [persistToken],
  )

  const loadProtectedData = useCallback(async (activeToken: string) => {
    const [accountResponse, dashboardResponse] = await Promise.all([
      request<AccountResponse>('/api/v1/courier/account', {}, activeToken),
      request<CourierDashboard>('/api/v1/courier/dashboard', {}, activeToken),
    ])

    return {
      account: accountResponse.account,
      dashboard: dashboardResponse,
    }
  }, [])

  const loadConsentStatus = useCallback(async (activeToken: string) => {
    const response = await request<PolicyConsentStatusResponse>('/api/v1/policy-consent/status', {}, activeToken)
    return response.data
  }, [])

  useEffect(() => {
    if (!token) {
      setRestoring(false)
      return
    }

    let cancelled = false
    setRestoring(true)
    setAuthError(null)
    setAccount(null)
    setDashboard(null)
    setConsentStatus(null)

    void request<MeResponse>('/api/v1/courier/auth/me', {}, token)
      .then(async (response) => {
        if (cancelled) {
          return
        }

        setCourier(response.courier)
        const nextConsentStatus = await loadConsentStatus(token)
        if (cancelled) {
          return
        }

        setConsentStatus(nextConsentStatus)
        if (!nextConsentStatus.all_required_accepted) {
          return
        }

        const protectedData = await loadProtectedData(token)
        if (cancelled) {
          return
        }

        setAccount(protectedData.account)
        setDashboard(protectedData.dashboard)
        setProfileForm(profileFormFromAccount(protectedData.account))
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        if (error instanceof ApiError && error.code === 'POLICY_CONSENT_REQUIRED') {
          void loadConsentStatus(token)
            .then((nextConsentStatus) => {
              if (!cancelled) {
                setConsentStatus(nextConsentStatus)
              }
            })
            .catch((consentError: unknown) => {
              if (!cancelled) {
                clearSession(errorMessage(consentError))
              }
            })
          return
        }

        clearSession(
          error instanceof ApiError && error.status === 401
            ? 'This bearer token is no longer valid. Sign in again.'
            : errorMessage(error),
        )
      })
      .finally(() => {
        if (!cancelled) {
          setRestoring(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [clearSession, loadConsentStatus, loadProtectedData, token])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusyAction('login')
    setAuthError(null)
    setNotice(null)

    try {
      const response = await request<LoginResponse>('/api/v1/courier/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginForm.email,
          password: loginForm.password,
          device_name: 'couriermockup-browser',
        }),
      })

      setRestoring(true)
      setConsentStatus(null)
      setAccount(null)
      setDashboard(null)
      persistToken(response.token)
      setCourier(response.courier)
      setLoginForm((current) => ({ ...current, password: '' }))
      setNotice('Login succeeded. Protected account and dashboard requests are loading.')
    } catch (error: unknown) {
      setAuthError(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  const handleConsentComplete = useCallback(async (nextStatus: PolicyConsentStatus) => {
    if (!token) {
      return
    }

    try {
      const protectedData = await loadProtectedData(token)
      setConsentStatus(nextStatus)
      setAccount(protectedData.account)
      setDashboard(protectedData.dashboard)
      setProfileForm(profileFormFromAccount(protectedData.account))
      setAuthError(null)
      setNotice('Policy acceptance saved. Courier workspace loaded.')
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession('This bearer token is no longer valid. Sign in again.')
        return
      }

      throw error
    }
  }, [clearSession, loadProtectedData, token])

  async function handleRefresh() {
    if (!token) {
      return
    }

    setBusyAction('refresh')
    setNotice(null)

    try {
      const protectedData = await loadProtectedData(token)
      setAccount(protectedData.account)
      setDashboard(protectedData.dashboard)
      setProfileForm(profileFormFromAccount(protectedData.account))
      setNotice('Account and dashboard refreshed from the API.')
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession('This bearer token is no longer valid. Sign in again.')
      } else if (error instanceof ApiError && error.code === 'POLICY_CONSENT_REQUIRED') {
        try {
          const nextConsentStatus = await loadConsentStatus(token)
          if (nextConsentStatus.all_required_accepted) {
            await handleConsentComplete(nextConsentStatus)
          } else {
            setConsentStatus(nextConsentStatus)
            setAccount(null)
            setDashboard(null)
            setAuthError(null)
            setNotice(null)
          }
        } catch (consentError: unknown) {
          setAuthError(errorMessage(consentError))
        }
      } else {
        setAuthError(errorMessage(error))
      }
    } finally {
      setBusyAction(null)
    }
  }

  async function handleLogout() {
    if (!token) {
      clearSession()
      return
    }

    setBusyAction('logout')
    let logoutMessage = 'Signed out.'
    let logoutError: string | null = null

    try {
      await request('/api/v1/courier/auth/logout', { method: 'POST' }, token)
    } catch (error: unknown) {
      if (!(error instanceof ApiError && error.status === 401)) {
        logoutError = errorMessage(error)
      }
      logoutMessage = 'The local bearer token was cleared.'
    } finally {
      clearSession()
      setNotice(logoutMessage)
      setAuthError(logoutError)
      setBusyAction(null)
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      return
    }

    setBusyAction('profile')
    setProfileError(null)
    setNotice(null)

    try {
      const response = await request<AccountResponse>(
        '/api/v1/courier/account/profile',
        {
          method: 'PATCH',
          body: JSON.stringify({
            first_name: profileForm.first_name,
            middle_name: profileForm.middle_name || null,
            last_name: profileForm.last_name,
            contact_number: profileForm.contact_number,
          }),
        },
        token,
      )

      setAccount(response.account)
      setProfileForm(profileFormFromAccount(response.account))
      setNotice(response.message ?? 'Profile updated.')
    } catch (error: unknown) {
      setProfileError(error)
      setAuthError(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      return
    }

    setBusyAction('password')
    setPasswordError(null)
    setNotice(null)

    try {
      await request(
        '/api/v1/courier/account/password',
        {
          method: 'PUT',
          body: JSON.stringify(passwordForm),
        },
        token,
      )

      clearSession()
      setNotice('Password updated. All Courier tokens were revoked; sign in again.')
    } catch (error: unknown) {
      setPasswordError(error)
      setAuthError(errorMessage(error))
    } finally {
      setBusyAction(null)
    }
  }

  if (restoring) {
    return <LoadingView message="Checking the stored bearer token…" />
  }

  if (!token || !courier) {
    return (
      <LoginView
        authError={authError}
        busy={busyAction === 'login'}
        form={loginForm}
        notice={notice}
        onChange={setLoginForm}
        onSubmit={handleLogin}
      />
    )
  }

  if (consentStatus && !consentStatus.all_required_accepted) {
    return (
      <PolicyConsentView
        onComplete={handleConsentComplete}
        onSignOut={() => void handleLogout()}
        onStatusChange={setConsentStatus}
        signingOut={busyAction === 'logout'}
        status={consentStatus}
        token={token}
      />
    )
  }

  if (!account || !dashboard) {
    return <LoadingView message="Loading the Courier workspace…" />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="header-copy">
            <h1>Courier API mockup</h1>
            <p>Development harness for the external Flutter contract.</p>
          </div>
          <p className="api-origin">API: {apiOriginLabel}</p>
        </div>
      </header>

      <main className="app-main">
        <div className="page-toolbar">
          <div>
            <h1>Authenticated endpoint check</h1>
            <p className="page-intro">The controls below call Laravel with the current bearer token.</p>
          </div>
          <div className="toolbar-actions">
            <Button
              className="min-h-10 rounded-md px-4 shadow-none"
              isLoading={busyAction === 'refresh'}
              loadingLabel="Refreshing"
              onClick={() => void handleRefresh()}
              variant="outline"
            >
              Refresh
            </Button>
            <Button
              className="min-h-10 rounded-md px-4 shadow-none"
              isLoading={busyAction === 'logout'}
              loadingLabel="Signing out"
              onClick={() => void handleLogout()}
              variant="ghost"
            >
              Sign out
            </Button>
          </div>
        </div>

        <nav className="policy-links" aria-label="Platform policies">
          <span className="policy-links-label">View policies</span>
          <button className="plain-link policy-link" onClick={() => setPolicyViewer('terms_of_service')} type="button">
            Terms of Service
          </button>
          <button className="plain-link policy-link" onClick={() => setPolicyViewer('privacy_policy')} type="button">
            Privacy Policy
          </button>
        </nav>

        {policyViewer ? <PolicyDocumentPanel onClose={() => setPolicyViewer(null)} type={policyViewer} /> : null}

        {notice ? <p className="notice" role="status">{notice}</p> : null}
        {authError ? <p className="error-message" role="alert">{authError}</p> : null}

        <div className="overview-grid">
          <section className="panel" aria-labelledby="session-heading">
            <div className="panel-header">
              <div>
                <h2 id="session-heading">Session</h2>
                <p className="panel-description">Identity returned by `/me`.</p>
              </div>
            </div>
            <dl className="key-value-list">
              <dt>Email</dt>
              <dd>{courier.email}</dd>
              <dt>Role</dt>
              <dd>{courier.role}</dd>
              <dt>Account status</dt>
              <dd>{courier.status}</dd>
              <dt>Affiliation</dt>
              <dd>{courier.logistics?.status ?? '—'}</dd>
              <dt>Organization</dt>
              <dd>{courier.logistics?.organization ?? '—'}</dd>
              <dt>Hub</dt>
              <dd>{courier.logistics?.hub ?? '—'}</dd>
            </dl>
          </section>

          <section className="panel" aria-labelledby="dashboard-heading">
            <div className="panel-header">
              <div>
                <h2 id="dashboard-heading">Dashboard scaffold</h2>
                <p className="panel-description">Truthful response from `/courier/dashboard`.</p>
              </div>
            </div>
            <p className="status-line">
              {dashboard.freshness.state} · {dashboard.freshness.reason ?? 'No reason returned'} · Generated {displayDate(dashboard.meta.generated_at)}
            </p>
            <dl className="dashboard-sections">
              {(
                [
                  ['Notifications', dashboard.sections.notifications],
                  ['Available tasks', dashboard.sections.available_tasks],
                  ['Active tasks', dashboard.sections.active_tasks],
                ] as const
              ).map(([label, section]) => (
                <div className="dashboard-section" key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {section.state}
                    {section.reason ? <span> · {section.reason}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
            <pre className="json-output">{JSON.stringify(dashboard.meta, null, 2)}</pre>
          </section>
        </div>

        <div className="forms-grid">
          <section className="panel" aria-labelledby="profile-heading">
            <div className="panel-header">
              <div>
                <h2 id="profile-heading">Profile update</h2>
                <p className="panel-description">Only the four allow-listed fields are sent.</p>
              </div>
            </div>
            <form className="stack" onSubmit={(event) => void handleProfileSubmit(event)}>
              <div className="form-grid">
                <TextField
                  error={fieldMessage(profileError, 'first_name')}
                  id="first-name"
                  label="First name"
                  onChange={(event) => setProfileForm((current) => ({ ...current, first_name: event.target.value }))}
                  value={profileForm.first_name}
                />
                <TextField
                  error={fieldMessage(profileError, 'middle_name')}
                  id="middle-name"
                  label="Middle name"
                  onChange={(event) => setProfileForm((current) => ({ ...current, middle_name: event.target.value }))}
                  value={profileForm.middle_name}
                />
                <TextField
                  error={fieldMessage(profileError, 'last_name')}
                  id="last-name"
                  label="Last name"
                  onChange={(event) => setProfileForm((current) => ({ ...current, last_name: event.target.value }))}
                  value={profileForm.last_name}
                />
                <TextField
                  error={fieldMessage(profileError, 'contact_number')}
                  id="contact-number"
                  label="Contact number"
                  onChange={(event) => setProfileForm((current) => ({ ...current, contact_number: event.target.value }))}
                  value={profileForm.contact_number}
                />
              </div>
              <div className="form-actions">
                <Button
                  className="min-h-10 rounded-md px-4 shadow-none"
                  isLoading={busyAction === 'profile'}
                  loadingLabel="Saving"
                  type="submit"
                  variant="secondary"
                >
                  Save profile
                </Button>
              </div>
            </form>
          </section>

          <section className="panel" aria-labelledby="password-heading">
            <div className="panel-header">
              <div>
                <h2 id="password-heading">Password change</h2>
                <p className="panel-description">Success revokes every Courier token.</p>
              </div>
            </div>
            <form className="stack" onSubmit={(event) => void handlePasswordSubmit(event)}>
              <TextField
                error={fieldMessage(passwordError, 'current_password')}
                id="current-password"
                label="Current password"
                onChange={(event) => setPasswordForm((current) => ({ ...current, current_password: event.target.value }))}
                type="password"
                value={passwordForm.current_password}
              />
              <TextField
                error={fieldMessage(passwordError, 'password')}
                id="new-password"
                label="New password"
                onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))}
                type="password"
                value={passwordForm.password}
              />
              <TextField
                error={fieldMessage(passwordError, 'password_confirmation')}
                id="password-confirmation"
                label="Confirm new password"
                onChange={(event) => setPasswordForm((current) => ({ ...current, password_confirmation: event.target.value }))}
                type="password"
                value={passwordForm.password_confirmation}
              />
              <div className="form-actions">
                <Button
                  className="min-h-10 rounded-md px-4 shadow-none"
                  isLoading={busyAction === 'password'}
                  loadingLabel="Updating"
                  type="submit"
                  variant="outline"
                >
                  Update password
                </Button>
              </div>
            </form>
          </section>
        </div>

        <PickupOrders token={token} />

        <section className="panel" aria-labelledby="contract-heading">
          <div className="panel-header">
            <div>
              <h2 id="contract-heading">Requests used by this mockup</h2>
              <p className="panel-description">All protected requests use the bearer token and omit browser credentials.</p>
            </div>
          </div>
          <ul className="request-list">
            <li><span className="request-method">GET</span><span className="request-path">/api/v1/courier/auth/me</span></li>
            <li><span className="request-method">GET</span><span className="request-path">/api/v1/policy-consent/status</span></li>
            <li><span className="request-method">POST</span><span className="request-path">/api/v1/policy-consent/:type/versions/:version/accept</span></li>
            <li><span className="request-method">GET</span><span className="request-path">/api/v1/platform/policies/:type</span></li>
            <li><span className="request-method">GET</span><span className="request-path">/api/v1/courier/account</span></li>
            <li><span className="request-method">GET</span><span className="request-path">/api/v1/courier/dashboard</span></li>
            <li><span className="request-method">GET</span><span className="request-path">/api/v1/courier/first-mile-tasks</span></li>
            <li><span className="request-method">POST</span><span className="request-path">/api/v1/courier/first-mile-tasks/:task/accept</span></li>
            <li><span className="request-method">POST</span><span className="request-path">/api/v1/courier/first-mile-tasks/:task/pickup</span></li>
            <li><span className="request-method">PATCH</span><span className="request-path">/api/v1/courier/account/profile</span></li>
            <li><span className="request-method">PUT</span><span className="request-path">/api/v1/courier/account/password</span></li>
            <li><span className="request-method">POST</span><span className="request-path">/api/v1/courier/auth/logout</span></li>
          </ul>
        </section>
      </main>
    </div>
  )
}

function LoadingView({ message }: { message: string }) {
  return (
    <main className="login-page">
      <section className="login-panel" aria-live="polite">
        <h1>Courier API mockup</h1>
        <p className="page-intro">{message}</p>
      </section>
    </main>
  )
}

interface LoginViewProps {
  authError: string | null
  busy: boolean
  form: { email: string; password: string }
  notice: string | null
  onChange: (value: { email: string; password: string }) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function LoginView({ authError, busy, form, notice, onChange, onSubmit }: LoginViewProps) {
  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-heading">
        <h1 id="login-heading">Courier API mockup</h1>
        <p className="page-intro">Use an approved Courier account to exercise the current Laravel contract.</p>

        {notice ? <p className="notice" role="status">{notice}</p> : null}
        {authError ? <p className="error-message" role="alert">{authError}</p> : null}

        <form onSubmit={onSubmit}>
          <TextField
            autoComplete="email"
            id="login-email"
            label="Courier email"
            onChange={(event) => onChange({ ...form, email: event.target.value })}
            required
            type="email"
            value={form.email}
          />
          <TextField
            autoComplete="current-password"
            id="login-password"
            label="Password"
            onChange={(event) => onChange({ ...form, password: event.target.value })}
            required
            type="password"
            value={form.password}
          />
          <Button
            className="min-h-10 rounded-md px-4 shadow-none"
            isLoading={busy}
            loadingLabel="Signing in"
            type="submit"
            variant="secondary"
          >
            Sign in with bearer token
          </Button>
        </form>

        <p className="rule-note">
          Auth rule: login receives the token once. Protected calls send <code>Authorization: Bearer …</code> with browser credentials omitted; no cookies or CSRF flow are used.
        </p>
      </section>
    </main>
  )
}

export default App
