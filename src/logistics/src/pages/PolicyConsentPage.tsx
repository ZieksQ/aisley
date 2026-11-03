import { useEffect } from 'react'
import { PolicyConsentPanel } from '@aisley/ui/policy-consent'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { acceptPolicies, fetchCurrentPolicy, fetchPolicyConsentStatus } from '../lib/policyConsent'

const api = { status: fetchPolicyConsentStatus, document: fetchCurrentPolicy, accept: acceptPolicies }
const storefrontUrl = (import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:3000').replace(/\/$/, '')

export function PolicyConsentPage() {
  const { logistics } = useAuth()
  useEffect(() => { document.title = 'Terms and Privacy | AISLEY Logistics' }, [])
  const location = useLocation()
  const navigate = useNavigate()
  const from: unknown = location.state?.from
  const safeFrom = typeof from === 'string'
    && from.startsWith('/')
    && !from.startsWith('//')
    && !Array.from(from).some((character) => character.charCodeAt(0) <= 32 || character === '\\')
    && !['/policy-consent', '/settings/terms'].some((path) => from.split(/[?#]/)[0] === path)
    ? from : null

  return (
    <div className="p-4 sm:p-6">
      <PolicyConsentPanel
        key={logistics?.id ?? 'signed-out'}
        api={api}
        accent="blue"
        historyBaseUrl={storefrontUrl}
        onComplete={() => { if (safeFrom) navigate(safeFrom, { replace: true }) }}
      />
    </div>
  )
}
