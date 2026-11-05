import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { FaChevronRight } from 'react-icons/fa6'
import { PortalModal, PortalState } from '@aisley/ui/portal'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { ApiError } from '../../lib/api'
import { createComplianceCase } from '../../lib/sellerCompliance'
import type { ComplianceSellerOption } from '../../types/sellerCompliance'
import { SellerIdentity } from './SellerIdentity'
import { SellerPickerDialog } from './SellerPickerDialog'
import { useComplianceOptions } from './useComplianceOptions'
import './compliance.css'

type Props = { open: boolean; onClose: () => void; onCreated: (id: string) => void }

export function CreateComplianceCaseDialog(props: Props) {
  return props.open ? <CaseForm onClose={props.onClose} onCreated={props.onCreated} /> : null
}

function CaseForm({ onClose, onCreated }: Omit<Props, 'open'>) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [seller, setSeller] = useState<ComplianceSellerOption | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [productId, setProductId] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submission = useRef<AbortController | null>(null)
  const { data, loading, error: optionsError, reload } = useComplianceOptions(seller ? new URLSearchParams({ seller_id: seller.id }).toString() : '')

  useEffect(() => () => submission.current?.abort(), [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!seller || loading || optionsError || reason.trim().length < 3 || submission.current) return
    const controller = new AbortController()
    submission.current = controller
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await createComplianceCase({ seller_id: seller.id, product_id: productId || null, policy_version_id: policyId || null, reason: reason.trim() }, controller.signal)
      if (!controller.signal.aborted) onCreated(response.data.id)
    } catch (requestError) {
      if (controller.signal.aborted) return
      if (requestError instanceof ApiError && requestError.status === 401) {
        void logout().finally(() => navigate('/login', { replace: true }))
        return
      }
      setError(requestError instanceof ApiError
        ? Object.values(requestError.errors).flat()[0] ?? requestError.message
        : requestError instanceof Error ? requestError.message : 'Unable to create this case.')
    } finally {
      if (!controller.signal.aborted) {
        submission.current = null
        setIsSubmitting(false)
      }
    }
  }

  return (
    <>
      <PortalModal title="Open Seller compliance case" description="Record the review basis. Opening a case does not change Seller or Product access." busy={isSubmitting} onClose={onClose}>
        <form className="portal-form-stack compliance-case-form" onSubmit={submit}>
          <fieldset disabled={isSubmitting} className="portal-form-stack">
            <div>
              <p className="compliance-label" id="compliance-seller-label">Seller <span aria-hidden="true">*</span></p>
              <button className="compliance-seller-trigger" type="button" aria-labelledby="compliance-seller-label compliance-seller-value" aria-haspopup="dialog" aria-describedby="compliance-seller-hint" onClick={() => setPickerOpen(true)}>
                <span id="compliance-seller-value">{seller ? <SellerIdentity seller={seller} /> : <span>Select a Seller to review</span>}</span>
                <FaChevronRight aria-hidden="true" />
              </button>
              <p className="portal-secondary mt-2 text-xs" id="compliance-seller-hint">Required. Search by shop, Seller name, or email and review their account details.</p>
            </div>
            <div className="compliance-scope-grid">
              <div className="portal-field">
                <label htmlFor="compliance-product">Product (optional)</label>
                <select id="compliance-product" className="portal-input" disabled={!seller || loading || Boolean(optionsError)} onChange={(event) => setProductId(event.target.value)} value={productId}>
                  <option value="">Seller-level case</option>
                  {data?.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.status}{product.is_restricted ? ' · restricted' : ''}</option>)}
                </select>
                <p className="portal-secondary mt-2 text-xs">Leave blank to review the Seller account.</p>
              </div>
              <div className="portal-field">
                <label htmlFor="compliance-policy">Policy version (optional)</label>
                <select id="compliance-policy" className="portal-input" disabled={loading || Boolean(optionsError)} onChange={(event) => setPolicyId(event.target.value)} value={policyId}>
                  <option value="">Documented platform rule</option>
                  {data?.policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.title} · v{policy.version}</option>)}
                </select>
                <p className="portal-secondary mt-2 text-xs">For an unversioned rule, identify it in the reason.</p>
              </div>
            </div>
            {loading && <p className="portal-secondary text-sm" role="status">Loading Product and policy options…</p>}
            {optionsError && <PortalState error title="Unable to load case options" description={optionsError} action={<button className="portal-button" type="button" onClick={reload}>Try again</button>} />}
            <div className="portal-field">
              <label htmlFor="compliance-reason">Review reason <span className="portal-required" aria-hidden="true">*</span></label>
              <textarea id="compliance-reason" className="portal-input" required minLength={3} maxLength={2000} rows={4} aria-describedby="compliance-reason-hint" onChange={(event) => setReason(event.target.value)} placeholder="Describe the listing behavior or platform rule being reviewed" value={reason} />
              <div className="compliance-reason-hint portal-secondary" id="compliance-reason-hint"><span>Required · 3–2,000 characters</span><span>{reason.length.toLocaleString()}/2,000</span></div>
            </div>
          </fieldset>
          {error && <p className="portal-field-error" role="alert">{error}</p>}
          <div className="compliance-dialog-footer">
            <button className="portal-button" disabled={isSubmitting} onClick={onClose} type="button">Cancel</button>
            <button className="portal-button portal-button-primary" disabled={isSubmitting || !seller || loading || Boolean(optionsError) || reason.trim().length < 3} type="submit">{isSubmitting ? 'Opening…' : 'Open case'}</button>
          </div>
        </form>
      </PortalModal>
      {pickerOpen && <SellerPickerDialog selectedId={seller?.id} onClose={() => setPickerOpen(false)} onSelect={(selected) => {
        if (selected.id !== seller?.id) setProductId('')
        setSeller(selected)
        setError(null)
        setPickerOpen(false)
      }} />}
    </>
  )
}
