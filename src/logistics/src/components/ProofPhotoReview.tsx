import { PortalButton } from '@aisley/ui/portal'
import { useEffect, useRef, useState } from 'react'
import { blob, csrf, request } from '../lib/api'

export function ProofPhotoReview({
  proofId,
  taskRevision,
  actionsEnabled,
  onRejected,
  onViewed,
}: {
  proofId: string
  taskRevision: number
  actionsEnabled: boolean
  onRejected: () => void
  onViewed: (id: string) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const currentProofId = useRef(proofId)
  currentProofId.current = proofId

  useEffect(() => {
    setUrl(null)
    setError(null)
  }, [proofId])

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const image = await blob(
        `/api/v1/logistics/delivery-proofs/${proofId}/photo`,
      )
      if (currentProofId.current !== proofId) return
      setUrl(URL.createObjectURL(image))
      onViewed(proofId)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Photo unavailable. Refresh the record.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function reject() {
    if (
      !actionsEnabled ||
      reason.trim().length < 3 ||
      !window.confirm(
        'Reject this photo POD? The Courier can submit a new photo.',
      )
    )
      return
    setRejecting(true)
    setError(null)
    try {
      await csrf()
      await request(`/api/v1/logistics/delivery-proofs/${proofId}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reason: reason.trim(),
          expected_revision: taskRevision,
        }),
      })
      onRejected()
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Proof rejection failed. Refresh the record.',
      )
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="mt-2">
      <PortalButton
        disabled={loading || !actionsEnabled}
        onClick={() => void load()}
      >
        {loading ? 'Loading photo…' : 'Review photo POD'}
      </PortalButton>
      {error ? (
        <p className="mt-1 text-xs text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {url ? (
        <img
          alt="Courier-submitted delivery proof for Logistics review"
          className="mt-2 max-h-80 max-w-full border border-slate-200 object-contain dark:border-slate-700"
          src={url}
        />
      ) : null}
      {url && actionsEnabled ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-400">
            Reason for rejection
            <input
              className="portal-input mt-1 min-h-11 w-full"
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              value={reason}
            />
          </label>
          <PortalButton
            variant="danger"
            disabled={rejecting || reason.trim().length < 3}
            onClick={() => void reject()}
            type="button"
          >
            {rejecting ? 'Rejecting…' : 'Reject photo'}
          </PortalButton>
        </div>
      ) : null}
    </div>
  )
}
