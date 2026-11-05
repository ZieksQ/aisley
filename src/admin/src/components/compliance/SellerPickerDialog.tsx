import { useState } from 'react'
import { PortalField, PortalModal, PortalPagination, PortalSkeleton, PortalState } from '@aisley/ui/portal'
import { complianceStatusLabel } from '../../lib/sellerCompliance'
import type { ComplianceSellerOption } from '../../types/sellerCompliance'
import { SellerIdentity } from './SellerIdentity'
import { useComplianceOptions } from './useComplianceOptions'

type Props = {
  selectedId?: string
  onClose: () => void
  onSelect: (seller: ComplianceSellerOption) => void
}

export function SellerPickerDialog({ selectedId, onClose, onSelect }: Props) {
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const params = new URLSearchParams({ seller_page: String(page) })
  if (search) params.set('seller_search', search)
  const { data, error, loading, reload } = useComplianceOptions(params.toString())

  return (
    <PortalModal title="Select a Seller" description="Find a shop or Seller and review their profile before opening a case." onClose={onClose}>
      <form className="compliance-picker-search" role="search" onSubmit={(event) => {
        event.preventDefault()
        setPage(1)
        setSearch(draft.trim())
        if (search === draft.trim() && page === 1) reload()
      }}>
        <PortalField autoFocus label="Search Sellers" type="search" maxLength={120} placeholder="Shop name, Seller name, or email" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <button className="portal-button portal-button-primary" type="submit">Search</button>
      </form>
      {loading ? <PortalSkeleton label="Loading Sellers" rows={3} /> : error ? (
        <PortalState error title="Unable to load Sellers" description={error} action={<button className="portal-button" onClick={reload}>Try again</button>} />
      ) : data?.sellers.length ? (
        <>
          <p className="portal-secondary mb-3 text-xs" role="status">{data.sellers_meta.total} Sellers{search ? ` matching “${search}”` : ''}</p>
          <ul className="compliance-seller-list">
            {data.sellers.map((seller) => (
              <li key={seller.id}>
                <SellerIdentity seller={seller} />
                <dl className="compliance-profile-details">
                  <div><dt>Account</dt><dd>{complianceStatusLabel(seller.status)}</dd></div>
                  <div><dt>Shop status</dt><dd>{seller.shop_status ? complianceStatusLabel(seller.shop_status) : 'Not provided'}</dd></div>
                  <div><dt>Phone</dt><dd>{seller.contact_number || 'Not provided'}</dd></div>
                  <div><dt>Joined</dt><dd>{seller.joined_at ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(seller.joined_at)) : 'Not provided'}</dd></div>
                </dl>
                <button className={`portal-button ${seller.id === selectedId ? '' : 'portal-button-primary'}`} type="button" onClick={() => onSelect(seller)} aria-label={`Select ${seller.shop_name || seller.name}`}>
                  {seller.id === selectedId ? 'Keep selected Seller' : 'Select Seller'}
                </button>
              </li>
            ))}
          </ul>
          <PortalPagination page={data.sellers_meta.current_page} lastPage={data.sellers_meta.last_page} total={data.sellers_meta.total} onPage={setPage} />
        </>
      ) : <PortalState title="No Sellers found" description="Try another shop name, Seller name, or email." />}
      <div className="compliance-dialog-footer"><button className="portal-button" onClick={onClose} type="button">Cancel</button></div>
    </PortalModal>
  )
}
