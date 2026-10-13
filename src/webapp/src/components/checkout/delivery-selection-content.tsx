"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiCheck } from "react-icons/fi";
import { Button } from "@aisley/ui";
import type { CheckoutLogisticsOptions } from "@/lib/checkout/types";
import { amount } from "./checkout-display";
import { useCheckout } from "./checkout-provider";

export function DeliverySelectionContent({ shopId }: { shopId: string | undefined }) {
  const checkout = useCheckout();
  const group = checkout.logisticsOptions?.groups.find((item) => item.shop.id === shopId);
  if (!checkout.customerId || checkout.status === "loading" || (checkout.status === "quoting" && !group)) {
    return <p role="status" className="py-12 text-center text-sm">Loading delivery providers…</p>;
  }
  if (!group || checkout.status === "placing" || checkout.status === "uncertain") {
    return (
      <div className="py-12 text-center text-sm">
        <p role="status">{checkout.status === "placing" || checkout.status === "uncertain"
          ? "Confirm your previous order before changing delivery providers."
          : checkout.message ?? "Return to checkout to choose a Shop and delivery address."}</p>
        <Link href="/checkout" className="mt-4 inline-flex min-h-11 items-center text-[#4C1268] underline">Back to checkout</Link>
      </div>
    );
  }
  return <DeliverySelection key={`${checkout.customerId}:${group.shop.id}`} group={group} />;
}

function DeliverySelection({ group }: { group: CheckoutLogisticsOptions["groups"][number] }) {
  const router = useRouter();
  const { selectedLogistics, selectLogisticsProvider, cancelShippingChange, status, message } = useCheckout();
  const [draft, setDraft] = useState(selectedLogistics[group.shop.id] ?? "");
  const applying = useRef(false);
  const busy = status === "quoting";

  useEffect(() => () => {
    if (applying.current) cancelShippingChange();
  }, [cancelShippingChange]);

  async function apply() {
    if (applying.current || busy || !draft) return;
    applying.current = true;
    try {
      if (await selectLogisticsProvider(group.shop.id, draft)) router.push("/checkout");
    } finally {
      applying.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-2xl border border-[#DED7E1] bg-white text-sm">
      <header className="flex items-center gap-3 border-b border-[#E6E0E8] p-4 sm:p-5">
        <Link href="/checkout" aria-label="Back to checkout" className="grid size-11 shrink-0 place-items-center rounded-md text-[#4C1268] focus-visible:outline-2 focus-visible:outline-[#E6007A]">
          <FiArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[#302534]">Select delivery provider</h1>
          <p className="mt-1 break-words text-[#665A6A]">{group.shop.name}</p>
        </div>
      </header>
      <div className="space-y-3 p-4 sm:p-5" aria-busy={busy}>
        <p className="leading-5 text-[#665A6A]">The lowest shipping fee is selected by default. You can choose another provider before placing your order.</p>
        <fieldset disabled={busy} className="min-w-0 space-y-2">
          <legend className="sr-only">Available delivery providers for {group.shop.name}</legend>
          {group.options.map((provider) => (
            <label key={provider.organizationId} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-md border p-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#4C1268] ${draft === provider.organizationId ? "border-[#E6007A] bg-[#FFF7FB]" : "border-[#DED7E1] hover:bg-[#FCFAFC]"}`}>
              <input type="radio" name="delivery-provider" value={provider.organizationId} checked={draft === provider.organizationId} onChange={() => setDraft(provider.organizationId)} className="size-4 shrink-0 accent-[#E6007A]" />
              <span className="min-w-0 flex-1 break-words font-medium text-[#302534]">{provider.businessName}</span>
              <span className="shrink-0 font-semibold text-[#3A2E3E]">{amount(provider.shippingFee)}</span>
              {draft === provider.organizationId ? <FiCheck aria-hidden="true" className="size-4 shrink-0 text-[#E6007A]" /> : null}
            </label>
          ))}
        </fieldset>
        {!group.options.length ? <p role="status" className="leading-6 text-[#765226]">Delivery is unavailable at this address. Return to checkout to change your address or refresh shipping options.</p> : null}
        {message ? <p role="alert" className="leading-5 text-[#B42318]">{message}</p> : null}
      </div>
      <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-[#E6E0E8] p-4 sm:p-5">
        <Link href="/checkout" className="inline-flex min-h-11 items-center px-3 font-medium text-[#4C1268] underline focus-visible:outline-2 focus-visible:outline-[#E6007A]">Cancel</Link>
        <Button className="!rounded-md !shadow-none" disabled={busy || !group.options.some((option) => option.organizationId === draft)} isLoading={busy} loadingLabel="Updating…" onClick={() => void apply()}>Apply delivery provider</Button>
      </footer>
    </div>
  );
}
