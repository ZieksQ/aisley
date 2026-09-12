import { useEffect, useMemo, useState } from 'react'
import { Button } from '@aisley/ui'
import { ApiError, request } from './lib/api'
import type {
  PolicyAcceptanceResponse,
  PolicyConsentItem,
  PolicyConsentStatus,
  PolicyConsentStatusResponse,
  PolicyDocumentResponse,
  PolicyType,
  PolicyVersion,
} from './types'

type PolicyCheckedState = Partial<Record<PolicyType, boolean>>
type PolicyDocumentState = Partial<Record<PolicyType, PolicyVersion>>

interface PolicyConsentViewProps {
  token: string
  status: PolicyConsentStatus
  signingOut: boolean
  onComplete: (status: PolicyConsentStatus) => Promise<void>
  onSignOut: () => void
  onStatusChange: (status: PolicyConsentStatus) => void
}

interface PolicyDocumentPanelProps {
  type: PolicyType
  onClose: () => void
}

function policyPath(type: PolicyType): string {
  return `/api/v1/platform/policies/${type}`
}

function acceptancePath(type: PolicyType, version: number): string {
  return `/api/v1/policy-consent/${type}/versions/${version}/accept`
}

function fallbackPolicyLabel(type: PolicyType): string {
  return type === 'terms_of_service' ? 'Terms of Service' : 'Privacy Policy'
}

function policyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message}${error.code ? ` (${error.code})` : ''}`
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'The policy request could not be completed.'
}

function formatPolicyDate(value: string | null): string {
  if (!value) {
    return 'Publication date unavailable'
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : `Published ${date.toLocaleDateString()}`
}

function policyVersionLabel(item: PolicyConsentItem): string {
  return item.current_version ? `Version ${item.current_version.version}` : 'Current version unavailable'
}

function PolicyText({ document }: { document: PolicyVersion }) {
  return (
    <div className="policy-copy" tabIndex={0}>
      {document.content}
    </div>
  )
}

export function PolicyConsentView({ token, status, signingOut, onComplete, onSignOut, onStatusChange }: PolicyConsentViewProps) {
  const pendingPolicies = useMemo(
    () => status.policies.filter((item) => item.required && !item.accepted),
    [status],
  )
  const [documents, setDocuments] = useState<PolicyDocumentState>({})
  const [checked, setChecked] = useState<PolicyCheckedState>({})
  const [loadingDocuments, setLoadingDocuments] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false
    setDocuments({})
    setChecked(Object.fromEntries(pendingPolicies.map((item) => [item.type, false])) as PolicyCheckedState)
    setError(null)

    if (pendingPolicies.length === 0) {
      setLoadingDocuments(false)
      return () => {
        cancelled = true
      }
    }

    setLoadingDocuments(true)
    void Promise.all(
      pendingPolicies.map(async (item) => {
        if (!item.current_version) {
          throw new Error(`${item.label} does not have a current published version.`)
        }

        const response = await request<PolicyDocumentResponse>(policyPath(item.type))
        if (response.data.version.version !== item.current_version.version) {
          throw new Error(`${item.label} changed while it was loading. Refresh and try again.`)
        }

        return [item.type, response.data.version] as const
      }),
    )
      .then((entries) => {
        if (!cancelled) {
          setDocuments(Object.fromEntries(entries) as PolicyDocumentState)
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDocuments(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [pendingPolicies])

  const allPoliciesChecked = pendingPolicies.every((item) => {
    return Boolean(checked[item.type]) && Boolean(documents[item.type])
  })

  async function refreshStatus() {
    setRefreshing(true)
    setError(null)

    try {
      const response = await request<PolicyConsentStatusResponse>('/api/v1/policy-consent/status', {}, token)
      if (response.data.all_required_accepted) {
        await onComplete(response.data)
      } else {
        onStatusChange(response.data)
      }
    } catch (requestError: unknown) {
      setError(requestError)
    } finally {
      setRefreshing(false)
    }
  }

  async function acceptPolicies() {
    if (!allPoliciesChecked || accepting) {
      return
    }

    setAccepting(true)
    setError(null)

    try {
      for (const item of pendingPolicies) {
        const version = item.current_version?.version
        if (version === undefined) {
          throw new Error(`${item.label} does not have a current version to accept.`)
        }

        await request<PolicyAcceptanceResponse>(
          acceptancePath(item.type, version),
          {
            method: 'POST',
            body: JSON.stringify({ confirmation: true }),
          },
          token,
        )
      }

      const response = await request<PolicyConsentStatusResponse>('/api/v1/policy-consent/status', {}, token)
      if (response.data.all_required_accepted) {
        await onComplete(response.data)
      } else {
        onStatusChange(response.data)
        setError(new Error('Some required policies still need acceptance.'))
      }
    } catch (requestError: unknown) {
      setError(requestError)
    } finally {
      setAccepting(false)
    }
  }

  return (
    <main className="policy-consent-page">
      <section className="policy-consent-shell" aria-labelledby="policy-consent-heading">
        <div className="policy-consent-header">
          <div>
            <h1 id="policy-consent-heading">Review the current platform policies</h1>
            <p className="page-intro">
              Read and confirm each policy below to continue to the Courier workspace. Your bearer session stays active while you review them.
            </p>
          </div>
          <Button
            className="min-h-10 rounded-md px-4 shadow-none"
            isLoading={signingOut}
            loadingLabel="Signing out"
            onClick={onSignOut}
            variant="ghost"
          >
            Sign out
          </Button>
        </div>

        {error ? <p className="error-message" role="alert">{policyErrorMessage(error)}</p> : null}

        {loadingDocuments ? (
          <p className="policy-loading" role="status">Loading the current policy text…</p>
        ) : (
          <div className="policy-consent-list">
            {pendingPolicies.map((item) => {
              const document = documents[item.type]
              const currentVersion = item.current_version

              return (
                <article className="policy-consent-item" key={item.type}>
                  <div className="policy-consent-item-header">
                    <div>
                      <h2>{item.label}</h2>
                      <p className="policy-meta">
                        {policyVersionLabel(item)} · {formatPolicyDate(currentVersion?.published_at ?? null)}
                      </p>
                    </div>
                    <span className="policy-status">Action required</span>
                  </div>

                  {document ? <PolicyText document={document} /> : null}

                  <label className="policy-confirmation">
                    <input
                      checked={Boolean(checked[item.type])}
                      disabled={!document || accepting}
                      onChange={(event) => setChecked((current) => ({ ...current, [item.type]: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>I have read and agree to the current {item.label}.</span>
                  </label>
                </article>
              )
            })}
          </div>
        )}

        <div className="policy-consent-actions">
          <p className="policy-consent-note">Only policies without a recorded acceptance for their required current version are shown.</p>
          <div className="form-actions">
            <Button
              className="min-h-10 rounded-md px-4 shadow-none"
              isLoading={refreshing}
              loadingLabel="Refreshing"
              onClick={() => void refreshStatus()}
              variant="outline"
            >
              Refresh policies
            </Button>
            <Button
              className="min-h-10 rounded-md px-4 shadow-none"
              disabled={!allPoliciesChecked || loadingDocuments || refreshing}
              isLoading={accepting}
              loadingLabel="Saving acceptance"
              onClick={() => void acceptPolicies()}
              variant="secondary"
            >
              Accept and continue
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}

export function PolicyDocumentPanel({ type, onClose }: PolicyDocumentPanelProps) {
  const [document, setDocument] = useState<PolicyVersion | null>(null)
  const [label, setLabel] = useState(fallbackPolicyLabel(type))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false
    setDocument(null)
    setLabel(fallbackPolicyLabel(type))
    setLoading(true)
    setError(null)

    void request<PolicyDocumentResponse>(policyPath(type))
      .then((response) => {
        if (!cancelled) {
          setDocument(response.data.version)
          setLabel(response.data.label)
        }
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(requestError)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [type])

  return (
    <section className="panel policy-viewer" aria-labelledby="policy-viewer-heading">
      <div className="panel-header">
        <div>
          <h2 id="policy-viewer-heading">{label}</h2>
          {document ? (
            <p className="policy-meta">Version {document.version} · {formatPolicyDate(document.published_at)}</p>
          ) : null}
        </div>
        <Button
          className="min-h-9 rounded-md px-3 shadow-none"
          onClick={onClose}
          variant="ghost"
        >
          Close
        </Button>
      </div>

      {loading ? <p className="policy-loading" role="status">Loading policy…</p> : null}
      {error ? <p className="error-message" role="alert">{policyErrorMessage(error)}</p> : null}
      {document ? <PolicyText document={document} /> : null}
    </section>
  )
}
