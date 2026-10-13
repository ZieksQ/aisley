"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button } from "@aisley/ui";
import type { CheckoutQuote } from "@/lib/checkout/types";
import { amount } from "./checkout-display";

export function CheckoutConfirmation({ quote, onCancel, onConfirm }: {
  quote: CheckoutQuote;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const element = dialog.current;
    element?.showModal();
    element?.focus({ preventScroll: true });
    if (element) element.scrollTop = 0;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  function containFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (document.activeElement === event.currentTarget || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
  }

  return (
    <dialog ref={dialog} tabIndex={-1} onKeyDown={containFocus} onCancel={onCancel} aria-labelledby="checkout-confirm-title" aria-describedby="checkout-confirm-help" className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-[#DED7E1] bg-white p-5 text-[#302534] outline-none backdrop:bg-[#281E2C]/45 sm:p-6">
      <h2 id="checkout-confirm-title" className="text-lg font-semibold">Confirm your order</h2>
      <p id="checkout-confirm-help" className="mt-2 text-sm leading-6 text-[#665A6A]">Please check your delivery details and total before placing {quote.summary.orderCount === 1 ? "your order" : "your orders"}.</p>
      <div className="mt-4 border-y border-[#E6E0E8] py-4 text-sm leading-6">
        <h3 className="font-semibold">Deliver to</h3>
        <p>{quote.address.recipientName} · {quote.address.contactNumber}</p>
        <p className="break-words text-[#665A6A]">{[quote.address.addressLine1, quote.address.addressLine2, quote.address.barangay, quote.address.cityMunicipality, quote.address.province, quote.address.postalCode].filter(Boolean).join(", ")}</p>
      </div>
      <ul className="mt-4 space-y-3 text-sm">
        {quote.groups.map((group) => (
          <li key={group.shop.id} className="flex items-start justify-between gap-4">
            <span className="min-w-0 break-words"><strong className="block font-medium">{group.shop.name}</strong><span className="text-[#665A6A]">{group.shippingQuote.logisticsBusinessName} · Shipping {amount(group.shippingQuote.shippingFee)}</span></span>
            <span className="shrink-0 font-semibold">{amount(group.totals.payable)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-5 flex items-center justify-between gap-4 border-t border-[#E6E0E8] pt-4">
        <dt className="text-sm font-semibold">Cash on delivery</dt>
        <dd className="text-xl font-semibold text-[#E6007A]">{amount(quote.summary.payable)}</dd>
      </dl>
      <p className="mt-2 text-xs leading-5 text-[#665A6A]">{quote.summary.orderCount} {quote.summary.orderCount === 1 ? "order" : "orders"}, one per Shop. Pay when delivered.</p>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button className="!rounded-md !shadow-none" variant="outline" onClick={onCancel}>Back to checkout</Button>
        <Button className="!rounded-md !shadow-none" onClick={onConfirm}>Confirm and place order</Button>
      </div>
    </dialog>
  );
}
