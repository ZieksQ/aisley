import { useCallback, useEffect, useState } from 'react'
import { FaCircleCheck, FaFileContract, FaRotate } from 'react-icons/fa6'
import { ApiError } from '../lib/api'
import { acceptPolicy, fetchCurrentPolicy, fetchPolicyConsentStatus } from '../lib/policyConsent'
import type { PolicyConsentItem, PolicyType, PolicyVersion } from '../types/policyConsent'

const policyOrder: PolicyType[] = ['terms_of_service', 'privacy_policy']
const storefrontUrl = (import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '')

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }).format(new Date(value)) : 'Date unavailable'
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'We could not load policy consent. Check your connection and try again.'
}

export function PolicyConsentPage() {
  const [policies, setPolicies] = useState<PolicyConsentItem[]>([])
  const [documents, setDocuments] = useState<Partial<Record<PolicyType, PolicyVersion>>>({})
  const [checked, setChecked] = useState<Partial<Record<PolicyType, boolean>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState<PolicyType | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetchPolicyConsentStatus()
      const nextPolicies = policyOrder
        .map((type) => response.data.policies.find((policy) => policy.type === type))
        .filter((policy): policy is PolicyConsentItem => Boolean(policy))
      const entries = await Promise.all(nextPolicies
        .filter((policy) => policy.current_version)
        .map(async (policy) => [policy.type, (await fetchCurrentPolicy(policy.type)).data.version] as const))
      setPolicies(nextPolicies)
      setDocuments(Object.fromEntries(entries))
      setChecked({})
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function accept(type: PolicyType, version: number) {
    setBusy(type)
    setError('')
    setMessage('')
    try {
      await acceptPolicy(type, version)
      setMessage(`${type === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy'} accepted.`)
      await load()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not record your acceptance. Refresh and try again.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <section className="space-y-4 p-5 sm:p-7"><div className="h-24 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" /><div className="h-80 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]" /></section>
  if (error && policies.length === 0) return <section className="p-5 sm:p-7"><div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800 dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</div><button className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 px-4 text-sm font-semibold dark:border-white/15" onClick={() => void load()} type="button"><FaRotate aria-hidden="true" />Try again</button></section>

  return <section className="max-w-5xl p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-600 dark:text-purple-300">Logistics account</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Policy consent</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Review the same platform-wide Terms of Service and Privacy Policy used across Aisley.</p></div><FaFileContract aria-hidden="true" className="mt-1 size-7 text-[#4C1268] dark:text-purple-300" /></div>{message ? <p className="mt-5 flex items-center gap-2 border-l-2 border-emerald-600 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200" role="status"><FaCircleCheck aria-hidden="true" />{message}</p> : null}{error ? <p className="mt-5 border-l-2 border-red-600 bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-200" role="alert">{error}</p> : null}<div className="mt-6 space-y-5">{policies.map((policy) => { const version = documents[policy.type]; const needsAcceptance = policy.required && Boolean(version); return <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#18181b] sm:p-6" key={policy.type}><div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4 dark:border-white/10"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-purple-600 dark:text-purple-300">Shared platform policy</p><h3 className="mt-1 text-lg font-semibold">{policy.label}</h3>{policy.current_version ? <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Version {policy.current_version.version} · Published {formatDate(policy.current_version.published_at)}</p> : null}</div><span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${policy.required ? 'bg-amber-100 text-amber-800 dark:bg-amber-300/15 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/15 dark:text-emerald-200'}`}>{policy.required ? 'Action required' : policy.accepted ? 'Accepted' : 'No action required'}</span></div>{!version ? <p className="mt-5 text-sm text-zinc-500">No published version is available yet.</p> : <><div className="mt-5 max-h-96 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-7 text-zinc-700 dark:text-zinc-300">{version.content}</div>{policy.current_version?.change_summary ? <p className="mt-5 border-l-2 border-purple-600 bg-purple-50 px-3 py-2 text-sm leading-6 text-purple-950 dark:bg-purple-400/10 dark:text-purple-100"><strong>What changed:</strong> {policy.current_version.change_summary}</p> : null}<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-white/10"><a className="text-sm font-semibold text-[#4C1268] hover:underline dark:text-purple-300" href={`${storefrontUrl}/policies/${policy.type}/history`} rel="noreferrer" target="_blank">View published history</a>{needsAcceptance ? <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300"><input checked={Boolean(checked[policy.type])} className="size-4 accent-[#4C1268]" onChange={(event) => setChecked((current) => ({ ...current, [policy.type]: event.target.checked }))} type="checkbox" />I have read and agree.</label><button className="inline-flex h-10 items-center rounded-lg bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3d0e54] disabled:opacity-50" disabled={!checked[policy.type] || busy !== null} onClick={() => void accept(policy.type, version.version)} type="button">{busy === policy.type ? 'Saving…' : 'Accept version'}</button></div> : <p className="text-sm text-zinc-500 dark:text-zinc-400">{policy.accepted_at ? `Accepted ${formatDate(policy.accepted_at)}.` : 'Your previous acceptance covers this version.'}</p>}</div></>}</article> })}</div></section>
}
