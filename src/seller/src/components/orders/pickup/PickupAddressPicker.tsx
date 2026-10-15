import { useEffect, useRef } from 'react'
import { FaLocationDot, FaXmark } from 'react-icons/fa6'
import { Link } from 'react-router-dom'
import { OrderButton } from '../OrderUi'
import { pickupAddressSummary } from '../../../lib/sellerPickupAddresses'
import type { PickupAddress } from '../../../types/pickupAddresses'

export function PickupAddressSection({
  address,
  addressLoading,
  addressesAvailable,
  onChoose,
}: {
  address?: PickupAddress
  addressLoading: boolean
  addressesAvailable: boolean
  onChoose: () => void
}) {
  return (
    <div className="border-b border-zinc-200 p-5 dark:border-white/10">
      <p className="text-sm font-medium">Pickup address</p>
      <p className="mt-1 text-xs text-zinc-500">
        The same location is saved on every waybill in this request.
      </p>
      {address ? (
        <div className="mt-3 flex flex-col justify-between gap-3 rounded-lg border border-zinc-200 p-4 dark:border-white/10 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{address.label || 'Pickup address'}</p>
              {address.is_default && (
                <span className="rounded-md bg-[#F1EAF4] px-2 py-1 text-xs font-semibold text-[#4C1268] dark:bg-purple-300/10 dark:text-purple-200">
                  Default
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {address.recipient_name} · {address.contact_number}
            </p>
            <p className="mt-1 truncate text-xs text-zinc-500">{pickupAddressSummary(address)}</p>
            {address.latitude !== null && address.longitude !== null ? (
              <p className="mt-1 text-xs text-zinc-500">
                Pin: {Number(address.latitude).toFixed(6)}, {Number(address.longitude).toFixed(6)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                No exact map pin saved.
              </p>
            )}
          </div>
          <OrderButton className="min-h-11!" disabled={addressLoading} onClick={onChoose}>
            Change address
          </OrderButton>
        </div>
      ) : (
        <OrderButton
          className="mt-3 min-h-11!"
          disabled={addressLoading || !addressesAvailable}
          onClick={onChoose}
        >
          {addressLoading ? 'Loading addresses…' : 'Choose address'}
        </OrderButton>
      )}
    </div>
  )
}

export function PickupAddressDialog({ addresses, onClose, onSelect, selectedId }: {
  addresses: PickupAddress[]
  onClose: () => void
  onSelect: (id: string) => void
  selectedId?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (!dialog.current?.open) dialog.current?.showModal() }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby="address-dialog-title"
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white p-0 text-zinc-950 shadow-xl backdrop:bg-black/55 dark:border-white/15 dark:bg-[#18181b] dark:text-zinc-100"
      onClose={onClose}
      onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 p-5 dark:border-white/10">
        <div>
          <h2 className="text-lg font-semibold" id="address-dialog-title">Choose pickup address</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            One address is saved on every waybill in this request.
          </p>
        </div>
        <button
          aria-label="Close address picker"
          className="grid size-11 shrink-0 place-items-center rounded-lg transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] dark:hover:bg-white/10"
          onClick={onClose}
          type="button"
        >
          <FaXmark aria-hidden="true" />
        </button>
      </div>

      <fieldset className="max-h-[62dvh] overflow-y-auto">
        <legend className="px-5 pt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Saved pickup addresses
        </legend>
        <div className="divide-y divide-zinc-200 dark:divide-white/10">
          {addresses.map((address) => (
            <label
              className={`flex min-h-20 cursor-pointer items-start gap-3 px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.035] ${selectedId === address.id ? 'bg-[#F7F1FA] dark:bg-purple-300/5' : ''}`}
              key={address.id}
            >
              <input
                checked={selectedId === address.id}
                className="mt-1 size-4 accent-[#4C1268] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]"
                name="pickup-address"
                onChange={() => onSelect(address.id)}
                type="radio"
                value={address.id}
              />
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#F1EAF4] text-[#4C1268] dark:bg-purple-300/10 dark:text-purple-200">
                <FaLocationDot aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="font-medium">{address.label || 'Pickup address'}</strong>
                  {address.is_default && (
                    <span className="rounded-md bg-[#F1EAF4] px-2 py-1 text-xs font-semibold text-[#4C1268] dark:bg-purple-300/10 dark:text-purple-200">
                      Default
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-300">
                  {address.recipient_name} · {address.contact_number}
                </span>
                <span className="mt-1 block text-xs leading-5 text-zinc-500">
                  {pickupAddressSummary(address)}
                </span>
                {address.latitude !== null && address.longitude !== null && (
                  <span className="mt-1 block text-xs text-zinc-500">Exact map pin saved</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 p-4 dark:border-white/10">
        <Link
          className="inline-flex min-h-11 items-center text-sm font-medium text-[#4C1268] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-purple-300"
          onClick={onClose}
          to="/account"
        >
          Manage pickup addresses
        </Link>
        <OrderButton onClick={onClose}>Cancel</OrderButton>
      </div>
    </dialog>
  )
}
