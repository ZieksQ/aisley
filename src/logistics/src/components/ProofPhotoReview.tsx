import { useEffect, useRef, useState } from 'react'
import { blob, csrf, request } from '../lib/api'

export function ProofPhotoReview({ proofId, taskRevision, actionsEnabled, onRejected, onViewed }: { proofId: string; taskRevision: number; actionsEnabled: boolean; onRejected: () => void; onViewed: (id: string) => void }) {
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

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const image = await blob(`/api/v1/logistics/delivery-proofs/${proofId}/photo`)
      if (currentProofId.current !== proofId) return
      setUrl(URL.createObjectURL(image))
      onViewed(proofId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Photo unavailable. Refresh the record.')
    } finally { setLoading(false) }
  }

  async function reject() {
    if (!actionsEnabled || reason.trim().length < 3 || !window.confirm('Reject this photo POD? The Courier can submit a new photo.')) return
    setRejecting(true)
    setError(null)
    try {
      await csrf()
      await request(`/api/v1/logistics/delivery-proofs/${proofId}/reject`, {
        method: 'POST', body: JSON.stringify({ reason: reason.trim(), expected_revision: taskRevision }),
      })
      onRejected()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Proof rejection failed. Refresh the record.') }
    finally { setRejecting(false) }
  }

  return <div className="mt-2">
    <button className="text-sm font-medium text-[#4C1268] underline disabled:opacity-50 dark:text-purple-300" disabled={loading} onClick={() => void load()} type="button">{loading ? 'Loading photo…' : 'Review photo POD'}</button>
    {error ? <p className="mt-1 text-xs text-red-700 dark:text-red-300" role="alert">{error}</p> : null}
    {url ? <img alt="Courier-submitted delivery proof for Logistics review" className="mt-2 max-h-80 max-w-full border border-zinc-200 object-contain dark:border-white/10" src={url} /> : null}
    {url && actionsEnabled ? <div className="mt-3 flex flex-wrap items-end gap-2"><label className="text-xs text-zinc-600 dark:text-zinc-400">Reason for rejection<input className="mt-1 block min-h-10 w-64 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 dark:border-white/20 dark:bg-zinc-900 dark:text-white" maxLength={1000} onChange={(event) => setReason(event.target.value)} value={reason} /></label><button className="min-h-10 rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-500/40 dark:text-red-300" disabled={rejecting || reason.trim().length < 3} onClick={() => void reject()} type="button">{rejecting ? 'Rejecting…' : 'Reject photo'}</button></div> : null}
  </div>
}
