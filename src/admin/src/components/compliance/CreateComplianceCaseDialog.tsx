import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { FaMagnifyingGlass, FaXmark } from 'react-icons/fa6'
import { ApiError } from '../../lib/api'
import { createComplianceCase, fetchComplianceOptions } from '../../lib/sellerCompliance'
import type { ComplianceOptionsResponse } from '../../types/sellerCompliance'

type Props = { open: boolean; onClose: () => void; onCreated: (id: string) => void }

export function CreateComplianceCaseDialog({ open, onClose, onCreated }: Props) {
  const [options, setOptions] = useState<ComplianceOptionsResponse['data']>({ sellers: [], products: [], policies: [] })
  const [sellerId, setSellerId] = useState('')
  const [productId, setProductId] = useState('')
  const [policyId, setPolicyId] = useState('')
  const [reason, setReason] = useState('')
  const [sellerSearch, setSellerSearch] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    setSellerId(''); setProductId(''); setPolicyId(''); setReason(''); setSellerSearch(''); setError(null)
    void loadOptions(new URLSearchParams())
  }, [open])

  async function loadOptions(params: URLSearchParams) {
    setIsLoading(true)
    setError(null)
    try { setOptions((await fetchComplianceOptions(params)).data) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load Seller options.') }
    finally { setIsLoading(false) }
  }

  function searchSellers() {
    const params = new URLSearchParams()
    if (sellerSearch.trim()) params.set('seller_search', sellerSearch.trim())
    void loadOptions(params)
  }

  function selectSeller(value: string) {
    setSellerId(value); setProductId('')
    const params = new URLSearchParams()
    if (value) params.set('seller_id', value)
    void loadOptions(params)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!sellerId || reason.trim().length < 3) return
    setIsSubmitting(true); setError(null)
    try {
      const response = await createComplianceCase({ seller_id: sellerId, product_id: productId || null, policy_version_id: policyId || null, reason: reason.trim() })
      onCreated(response.data.id)
    } catch (requestError) {
      setError(requestError instanceof ApiError
        ? requestError.errors.reason?.[0] ?? requestError.errors.product_id?.[0] ?? requestError.message
        : requestError instanceof Error ? requestError.message : 'Unable to create this case.')
    } finally { setIsSubmitting(false) }
  }

  if (!open) return null

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/65 p-4">
    <div aria-labelledby={titleId} aria-modal="true" className="my-6 w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-[#17111d]" role="dialog">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold" id={titleId}>Open Seller compliance case</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create a manual review without changing Seller or Product access.</p></div><button aria-label="Close" className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10" disabled={isSubmitting} onClick={onClose} type="button"><FaXmark /></button></div>

      <form className="mt-6 space-y-5" onSubmit={submit}>
        <div><label className="text-sm font-medium" htmlFor="seller-search">Find Seller</label><div className="mt-2 flex gap-2"><div className="relative min-w-0 flex-1"><FaMagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#E6007A] dark:border-white/10 dark:bg-white/5" id="seller-search" onChange={(event) => setSellerSearch(event.target.value)} placeholder="Name, email, or shop" value={sellerSearch} /></div><button className="rounded-lg border border-slate-200 px-4 text-sm font-semibold dark:border-white/10" disabled={isLoading} onClick={searchSellers} type="button">Search</button></div></div>

        <label className="block text-sm font-medium">Seller <span className="text-rose-600">*</span><select className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#E6007A] dark:border-white/10 dark:bg-[#17111d]" disabled={isLoading} onChange={(event) => selectSeller(event.target.value)} value={sellerId}><option value="">Select a Seller</option>{options.sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name} · {seller.shop_name ?? 'No shop'} · {seller.email}</option>)}</select></label>
        <label className="block text-sm font-medium">Product <span className="font-normal text-slate-400">(optional)</span><select className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#E6007A] disabled:opacity-50 dark:border-white/10 dark:bg-[#17111d]" disabled={!sellerId || isLoading} onChange={(event) => setProductId(event.target.value)} value={productId}><option value="">Seller-level case</option>{options.products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.status}{product.is_restricted ? ' · restricted' : ''}</option>)}</select></label>
        <label className="block text-sm font-medium">Policy version <span className="font-normal text-slate-400">(optional)</span><select className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#E6007A] dark:border-white/10 dark:bg-[#17111d]" onChange={(event) => setPolicyId(event.target.value)} value={policyId}><option value="">Documented platform rule not yet versioned</option>{options.policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.title} · v{policy.version}</option>)}</select></label>
        <label className="block text-sm font-medium">Review reason <span className="text-rose-600">*</span><textarea className="mt-2 min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E6007A] dark:border-white/10 dark:bg-white/5" maxLength={2000} onChange={(event) => setReason(event.target.value)} placeholder="Identify the listing behavior or platform rule being reviewed" value={reason} /></label>
        {error && <p className="text-sm text-rose-600 dark:text-rose-300" role="alert">{error}</p>}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 dark:border-white/10 sm:flex-row sm:justify-end"><button className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold dark:border-white/10" disabled={isSubmitting} onClick={onClose} type="button">Cancel</button><button className="rounded-lg bg-[#4C1268] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={isSubmitting || !sellerId || reason.trim().length < 3} type="submit">{isSubmitting ? 'Opening…' : 'Open case'}</button></div>
      </form>
    </div>
  </div>
}
