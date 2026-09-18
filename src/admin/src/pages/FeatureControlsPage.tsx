import { useCallback, useEffect, useState } from 'react'
import { FaCircleInfo, FaRotate, FaToggleOn } from 'react-icons/fa6'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../lib/api'
import { fetchFeatureControls, updateFeatureControl } from '../lib/featureControls'
import type { FeatureControl } from '../types/featureControls'

function requestMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 403) return 'Your administrator account does not have permission to view or manage feature controls.'
  return error instanceof Error ? error.message : 'Unable to load feature controls.'
}

export function FeatureControlsPage() {
  const { admin, logout } = useAuth()
  const navigate = useNavigate()
  const canManage = admin?.permissions.includes('platform-settings.manage') ?? false
  const [controls, setControls] = useState<FeatureControl[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const response = await fetchFeatureControls(signal)
      setControls(response.data)
    } catch (caught) {
      if (signal.aborted) return
      if (caught instanceof ApiError && caught.status === 401) {
        void logout().finally(() => navigate('/login', { replace: true }))
        return
      }
      setError(requestMessage(caught))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [logout, navigate])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, reloadKey])

  async function toggle(control: FeatureControl) {
    const nextEnabled = !control.enabled
    if (control.key === 'policy_consent_enforcement' && control.enabled && !window.confirm('Turn off policy consent enforcement? Users will be able to use protected areas without accepting the current Terms and Privacy Policy.')) return

    setBusyKey(control.key)
    setError('')
    setMessage('')
    try {
      const response = await updateFeatureControl(control.key, nextEnabled, control.revision)
      setControls((current) => current.map((item) => item.key === control.key ? response.data : item))
      setMessage(`${control.label} is now ${response.data.enabled ? 'enabled' : 'disabled'}.`)
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        setError('This control changed in another session. The latest value has been loaded.')
        setReloadKey((value) => value + 1)
      } else {
        setError(requestMessage(caught))
      }
    } finally {
      setBusyKey(null)
    }
  }

  useEffect(() => { document.title = 'Feature controls | Aisley Admin' }, [])

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-10">
      <div className="border-b border-slate-200 pb-5 dark:border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Feature controls</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Manage platform-wide switches. Changes apply at the API boundary and are recorded in the Admin audit log.</p>
          </div>
          <FaToggleOn aria-hidden="true" className="mt-1 size-7 shrink-0 text-[#E6007A]" />
        </div>
      </div>

      {message ? <p className="mt-5 border-l-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200" role="status">{message}</p> : null}
      {error ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-rose-600 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-400/10 dark:text-rose-200" role="alert"><span>{error}</span><button className="font-semibold underline underline-offset-2" onClick={() => setReloadKey((value) => value + 1)} type="button">Retry</button></div> : null}

      <section className="mt-6" aria-labelledby="feature-controls-heading">
        <div className="flex items-center gap-2"><h3 className="font-semibold" id="feature-controls-heading">Available controls</h3><span className="text-xs text-slate-400">{controls.length}</span></div>
        {loading ? (
          <div className="mt-4 space-y-3" aria-label="Loading feature controls">
            {[1, 2].map((item) => <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]" key={item} />)}
          </div>
        ) : controls.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/15 dark:text-slate-400"><FaCircleInfo aria-hidden="true" className="mx-auto text-lg" /><p className="mt-3">No feature controls are configured.</p></div>
        ) : (
          <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.035]">
            {controls.map((control) => (
              <article className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between" key={control.key}>
                <div className="min-w-0">
                  <h4 className="font-semibold">{control.label}</h4>
                  {control.description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{control.description}</p> : null}
                  <p className="mt-2 text-xs text-slate-400">Key: {control.key} · Revision {control.revision}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`text-sm font-semibold ${control.enabled ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>{control.enabled ? 'Enabled' : 'Disabled'}</span>
                  <button
                    aria-checked={control.enabled}
                    aria-label={`${control.label}: ${control.enabled ? 'enabled' : 'disabled'}`}
                    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#E6007A] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:focus:ring-offset-[#0b0d13] ${control.enabled ? 'border-[#4C1268] bg-[#4C1268]' : 'border-slate-300 bg-slate-200 dark:border-white/15 dark:bg-white/10'}`}
                    disabled={!canManage || busyKey !== null}
                    onClick={() => void toggle(control)}
                    role="switch"
                    type="button"
                  >
                    <span className={`size-5 rounded-full bg-white shadow-sm transition-transform ${control.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 flex items-start gap-3 border-t border-slate-200 pt-5 text-sm leading-6 text-slate-500 dark:border-white/10 dark:text-slate-400"><FaCircleInfo aria-hidden="true" className="mt-1 shrink-0" /><p>Turning off a control preserves existing data. Pausing linehaul prevents new routes and departures; parcels already in transit can still be received.</p></div>
      {!loading && error ? <button className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#b0005d] dark:text-pink-300" onClick={() => setReloadKey((value) => value + 1)} type="button"><FaRotate aria-hidden="true" />Try again</button> : null}
    </div>
  )
}
