import { useEffect, useRef } from "react";
import { Button } from "@aisley/ui";
import { isCurrentOrderAddress } from "@/lib/orders/address-correction";
import { formatOrderMoney } from "@/lib/orders/format";
import type { OrderAddressQuote, OrderDetail } from "@/lib/orders/types";
import type { CustomerAddress } from "@/lib/checkout/types";

type Props = {
  reference: string;
  currentAddress: OrderDetail["deliveryAddress"];
  quote: OrderAddressQuote | null;
  addresses: CustomerAddress[];
  loading: boolean;
  busy: boolean;
  uncertain: boolean;
  selectedId: string | null;
  error: string | null;
  fieldError: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function OrderContactDialog({
  reference, addresses, currentAddress, quote, loading, busy, uncertain, selectedId,
  error, fieldError, onSelect, onClose, onSubmit,
}: Props) {
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const blocked = useRef(busy || uncertain);
  useEffect(() => { close.current = onClose; blocked.current = busy || uncertain; });

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const section = dialog.current;
    section?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!blocked.current) close.current();
      }
      if (event.key !== "Tab" || !section) return;
      const controls = Array.from(section.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href]',
      ));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); section.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === section)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === section)) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#281E2C]/45 px-4 py-6">
      <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="order-contact-heading" aria-describedby="order-contact-help" className="max-h-[calc(100dvh-3rem)] w-full max-w-lg overflow-y-auto border border-[#DED7E1] bg-white p-5 shadow-[0_2px_8px_rgba(40,30,44,0.18)] outline-none sm:p-6">
        <h2 id="order-contact-heading" className="text-lg font-semibold text-[#2D2231]">Change delivery address</h2>
        <p id="order-contact-help" className="mt-2 text-sm leading-6 text-[#6B5F6F]">
          Select a saved shipping address for order {reference}. Review delivery and total cash on delivery before confirming. Changes are available until the seller approves the order.
        </p>
        {loading ? <p role="status" className="mt-5 text-sm text-[#6B5F6F]">Loading saved addresses…</p> : addresses.length ? (
          <fieldset className="mt-5 min-w-0 space-y-2" disabled={busy || uncertain} aria-describedby={fieldError ? "order-contact-field-error" : undefined}>
            <legend className="text-sm font-semibold text-[#3A2E3E]">Saved shipping addresses</legend>
            {addresses.map((address) => (
              <label key={address.id} className="flex cursor-pointer items-start gap-3 border border-[#DED7E1] px-3 py-3 hover:bg-[#FAF7FB] focus-within:outline-2 focus-within:outline-[#4C1268]">
                <input type="radio" name="order-contact" value={address.id} checked={selectedId === address.id} onChange={() => onSelect(address.id)} disabled={isCurrentOrderAddress(currentAddress, address)} className="mt-1 accent-[#4C1268]" />
                <span className="min-w-0 break-words text-sm leading-5 text-[#514656]">
                  <strong className="font-semibold text-[#302534]">{address.label || "Saved address"}</strong>{isCurrentOrderAddress(currentAddress, address) ? <span className="ml-2 text-xs">Current address</span> : null}<br />
                  {address.recipientName} · {address.contactNumber}<br />
                  {address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ""}, {address.barangay}, {address.cityMunicipality}, {address.province}, {address.region} {address.postalCode}, {address.country}
                </span>
              </label>
            ))}
          </fieldset>
        ) : !error ? (
          <p className="mt-5 border border-[#E3CFB5] bg-[#FFF9F0] px-3 py-3 text-sm text-[#765226]">
            No saved shipping addresses are available. Save a shipping address in your Address Book, then return to this order.
          </p>
        ) : null}
        {quote ? (
          <section aria-labelledby="address-quote-heading" className="mt-5 rounded-lg bg-[#F7F5F7] p-4 text-sm text-[#231429]" aria-live="polite">
            <h3 id="address-quote-heading" className="font-semibold">Review delivery change</h3>
            <p className="mt-2 break-words">{quote.address.recipientName} · {quote.address.contactNumber}</p>
            <p className="mt-1 break-words">{[quote.address.addressLine1, quote.address.addressLine2, quote.address.barangay, quote.address.cityMunicipality, quote.address.province, quote.address.region, quote.address.postalCode, quote.address.country].filter(Boolean).join(", ")}</p>
            <p className="mt-2">Delivery provider: {quote.shippingProvider.businessName}</p>
            <dl className="mt-3 space-y-2">
              {([
                ["Shipping fee", "shippingFee"], ["Shipping saving", "shippingDiscount"], ["Total cash on delivery", "payable"],
              ] as const).map(([label, field]) => (
                <div key={field} className="flex flex-wrap justify-between gap-2">
                  <dt>{label}</dt>
                  <dd className="text-right tabular-nums">
                    <span className="block text-xs text-[#665A6A]">Current: {formatOrderMoney(quote.previous[field], quote.previous.currency)}</span>
                    <strong className="font-semibold">New: {formatOrderMoney(quote.proposed[field], quote.proposed.currency)}</strong>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        {error ? <p role="alert" className="mt-3 text-sm text-[#9D174D]">{error}</p> : null}
        {fieldError ? <p id="order-contact-field-error" className="mt-2 text-sm text-[#9D174D]">{fieldError}</p> : null}
        {uncertain ? <p role="status" className="mt-3 text-sm text-[#6B5F6F]">The outcome is unconfirmed. Retry the original address change before making another change.</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy || uncertain} className="!min-h-11 !rounded-md !px-4">Keep current address</Button>
          <Button variant="secondary" onClick={onSubmit} isLoading={busy} loadingLabel="Updating…" disabled={loading || !selectedId || (!uncertain && addresses.some(address => address.id === selectedId && isCurrentOrderAddress(currentAddress, address)))} className="!min-h-11 !rounded-md !px-4 !shadow-none">
            {uncertain ? "Retry original change" : quote ? "Confirm address change" : "Review delivery total"}
          </Button>
        </div>
      </section>
    </div>
  );
}
