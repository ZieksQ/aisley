import type { ComplianceSeller } from '../../types/sellerCompliance'

export function SellerIdentity({ seller }: { seller: ComplianceSeller }) {
  const initials = seller.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return (
    <span className="compliance-seller-identity">
      <span className="compliance-avatar" aria-hidden="true">{initials}</span>
      <span className="min-w-0">
        <span className="block font-semibold">{seller.shop_name || 'No shop'}</span>
        <span className="block portal-secondary mt-1 text-sm">{seller.name}</span>
        <span className="block portal-secondary mt-1 text-xs break-all">{seller.email}</span>
      </span>
    </span>
  )
}
