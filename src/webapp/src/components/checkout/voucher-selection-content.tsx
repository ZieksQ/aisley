"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { Button } from "@aisley/ui";
import type { CheckoutQuote } from "@/lib/checkout/types";
import { toggleVoucherSelection } from "@/lib/checkout/voucher-selection";
import { useCheckout } from "./checkout-provider";
import { VoucherTicket } from "./voucher-ticket";
import "./voucher-selection.css";

export function VoucherSelectionContent({
  shopId,
}: {
  shopId: string | undefined;
}) {
  const checkout = useCheckout();
  const group = checkout.quote?.groups.find((item) => item.shop.id === shopId);
  if (
    !checkout.customerId ||
    checkout.status === "loading" ||
    (checkout.status === "quoting" && !group)
  ) {
    return (
      <p role="status" className="py-12 text-center text-sm">
        Loading vouchers…
      </p>
    );
  }
  if (checkout.status === "placing" || checkout.status === "uncertain") {
    return (
      <VoucherSelectionUnavailable message="Confirm your previous order before changing vouchers." />
    );
  }
  if (!group) {
    return (
      <VoucherSelectionUnavailable
        message={
          checkout.message ??
          "Return to checkout to select a Shop and shipping option."
        }
      />
    );
  }
  return (
    <VoucherSelection
      key={`${checkout.customerId}:${group.shop.id}`}
      group={group}
    />
  );
}

function VoucherSelection({
  group,
}: {
  group: CheckoutQuote["groups"][number];
}) {
  const router = useRouter();
  const { quote, selectedVouchers, applyVouchers, status, message } =
    useCheckout();
  const [draft, setDraft] = useState(selectedVouchers);
  const [filter, setFilter] = useState<"all" | "discount" | "shipping">("all");
  const busy = status === "quoting";
  const count = draft.filter(
    (item) => item.target_shop_id === group.shop.id,
  ).length;
  const candidates = group.availableVouchers.filter(
    (voucher) => filter === "all" || voucher.benefitType === filter,
  );

  async function apply() {
    if (await applyVouchers(draft)) router.push("/checkout");
  }

  return (
    <div className="checkout-voucher-page">
      <header className="checkout-voucher-header">
        <Link href="/checkout" aria-label="Back to checkout">
          <FiArrowLeft aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <h1>Select vouchers</h1>
          <p>{group.shop.name}</p>
        </div>
      </header>
      <div className="checkout-voucher-filters" aria-label="Filter vouchers">
        {(
          [
            ["all", "All"],
            ["discount", "Discount"],
            ["shipping", "Shipping"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="checkout-voucher-list" aria-busy={busy}>
        {(
          [
            ["app", "Aisley vouchers"],
            ["shop", "Shop vouchers"],
          ] as const
        ).map(([issuer, title]) => {
          const vouchers = candidates.filter(
            (voucher) => voucher.issuerType === issuer,
          );
          return vouchers.length ? (
            <section key={issuer} aria-labelledby={`voucher-section-${issuer}`}>
              <h2 id={`voucher-section-${issuer}`}>{title}</h2>
              <div className="checkout-voucher-tickets">
                {vouchers.map((voucher) => (
                  <VoucherTicket
                    key={voucher.id}
                    voucher={voucher}
                    selected={draft.some(
                      (item) =>
                        item.voucher_id === voucher.id &&
                        item.target_shop_id === group.shop.id,
                    )}
                    disabled={busy}
                    onSelect={() =>
                      setDraft((current) =>
                        toggleVoucherSelection(
                          current,
                          voucher,
                          group.shop.id,
                          quote!.groups,
                        ),
                      )
                    }
                  />
                ))}
              </div>
            </section>
          ) : null;
        })}
        {!candidates.length ? (
          <p className="py-10 text-center text-sm text-[#665A6A]">
            No {filter === "all" ? "" : `${filter} `}vouchers for this order.
          </p>
        ) : null}
      </div>
      {message ? (
        <p role="alert" className="checkout-voucher-error">
          {message}
        </p>
      ) : null}
      <footer className="checkout-voucher-footer">
        <span aria-live="polite">{count} selected</span>
        <Button
          className="checkout-voucher-apply"
          disabled={busy}
          isLoading={busy}
          loadingLabel="Applying…"
          onClick={() => void apply()}
        >
          Apply vouchers
        </Button>
      </footer>
    </div>
  );
}

function VoucherSelectionUnavailable({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-sm">
      <p role="status">{message}</p>
      <Link
        href="/checkout"
        className="mt-4 inline-flex min-h-11 items-center text-[#4C1268] underline"
      >
        Back to checkout
      </Link>
    </div>
  );
}
