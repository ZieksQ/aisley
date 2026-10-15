import { PortalModal } from '@aisley/ui/portal'
import { Link } from 'react-router-dom'
import { OrderButton } from '../OrderUi'
import { pickupAddressSummary } from '../../../lib/sellerPickupAddresses'
import type { PickupAddress } from '../../../types/pickupAddresses'

export function PickupAddressSection({ address, addressLoading, addressesAvailable, onChoose }: {
  address?: PickupAddress
  addressLoading: boolean
  addressesAvailable: boolean
  onChoose: () => void
}) {
  return (
    <div className="border-b border-[var(--portal-border)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--portal-muted)]">Pickup address</p>
          {address ? (
            <>
              <p className="mt-1 text-sm font-medium">
                {address.label || 'Pickup address'}
                {address.is_default && <span className="portal-tag ml-2">Default</span>}
              </p>
              <p className="portal-secondary mt-1 text-xs leading-5">
                {address.recipient_name} · {address.contact_number}<br />
                {pickupAddressSummary(address)}
              </p>
              {address.latitude === null || address.longitude === null ? (
                <p className="portal-secondary mt-1 text-xs">No exact map pin saved.</p>
              ) : null}
            </>
          ) : <p className="portal-secondary mt-1 text-sm">{addressLoading ? 'Loading addresses…' : 'Choose a saved pickup address.'}</p>}
        </div>
        <OrderButton disabled={addressLoading || !addressesAvailable} onClick={onChoose}>
          {address ? 'Change address' : 'Choose address'}
        </OrderButton>
      </div>
    </div>
  )
}

export function PickupAddressDialog({ addresses, onClose, onSelect, selectedId }: {
  addresses: PickupAddress[]
  onClose: () => void
  onSelect: (id: string) => void
  selectedId?: string
}) {
  return (
    <PortalModal title="Choose pickup address" description="One address is saved on every waybill in this request." onClose={onClose}>
      <fieldset className="divide-y divide-[var(--portal-border)]">
        <legend className="sr-only">Saved pickup addresses</legend>
        {addresses.map((address) => (
          <label className="flex cursor-pointer items-start gap-3 px-1 py-3" key={address.id}>
            <input checked={selectedId === address.id} className="mt-1 size-4 accent-[var(--portal-accent)]"
              name="pickup-address" onChange={() => onSelect(address.id)} type="radio" value={address.id} />
            <span className="min-w-0 flex-1">
              <strong className="text-sm font-medium">{address.label || 'Pickup address'}</strong>
              {address.is_default && <span className="portal-tag ml-2">Default</span>}
              <span className="portal-secondary mt-1 block text-xs leading-5">
                {address.recipient_name} · {address.contact_number}<br />{pickupAddressSummary(address)}
              </span>
              {address.latitude !== null && address.longitude !== null && (
                <span className="portal-secondary mt-1 block text-xs">Exact map pin saved</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="order-dialog-actions flex-wrap justify-between!">
        <Link className="portal-button portal-button-ghost" onClick={onClose} to="/account">Manage addresses</Link>
        <OrderButton onClick={onClose}>Cancel</OrderButton>
      </div>
    </PortalModal>
  )
}
