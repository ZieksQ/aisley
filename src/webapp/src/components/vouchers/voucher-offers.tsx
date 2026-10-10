"use client";

import Link from "next/link";
import { Button } from "@aisley/ui";
import { useAuth } from "@/components/auth/auth-provider";
import type { CustomerVoucher } from "@/lib/vouchers/types";
import { VoucherAction, VoucherCard } from "./voucher-card";
import { VoucherDetailContent } from "./voucher-detail-content";
import { useVoucherOffers } from "./use-voucher-offers";

export function VoucherOffers(props: {
  items: CustomerVoucher[];
  shopSlug?: string;
  privateItems?: boolean;
  detail?: boolean;
  returnPath?: string;
}) {
  const { auth } = useAuth();
  const owner = auth.status === "authenticated" ? auth.customer.id : null;
  return (
    <Offers
      key={`${owner ?? auth.status}:${JSON.stringify(props.items)}`}
      {...props}
      owner={owner}
      checkingSession={auth.status === "loading"}
    />
  );
}

function Offers({
  items,
  owner,
  shopSlug,
  privateItems,
  detail,
  checkingSession,
  returnPath,
}: {
  items: CustomerVoucher[];
  owner: string | null;
  shopSlug?: string;
  privateItems?: boolean;
  detail?: boolean;
  checkingSession: boolean;
  returnPath?: string;
}) {
  const state = useVoucherOffers(items, owner, shopSlug, privateItems);
  const disabled =
    checkingSession ||
    state.waiting ||
    state.busy !== null ||
    state.remaining > 0;
  function action(voucher: CustomerVoucher) {
    return (
      <VoucherAction
        returnPath={returnPath}
        voucher={voucher}
        owner={owner}
        shopSlug={shopSlug}
        disabled={disabled}
        busy={state.busy === voucher.id}
        onCollect={(offer) => void state.collect(offer)}
      />
    );
  }
  return (
    <>
      {state.waiting && !state.error && (
        <p className="voucher-feedback" role="status">
          Checking your voucher collection…
        </p>
      )}
      {state.error && (
        <div className="voucher-feedback" role="alert">
          <p>{state.error}</p>
          {state.consentRequired && (
            <Link
              className="voucher-details-link"
              href={`/account/policy-consent?next=${encodeURIComponent(returnPath ?? (shopSlug ? `/shops/${shopSlug}#vouchers` : "/vouchers"))}`}
            >
              Read and accept required policies
            </Link>
          )}
          {state.waiting && (
            <Button
              variant="outline"
              disabled={state.remaining > 0}
              onClick={state.retry}
            >
              {state.remaining
                ? `Retry in ${state.remaining}s`
                : "Retry status check"}
            </Button>
          )}
        </div>
      )}
      {state.remaining > 0 && (
        <p role="status" className="voucher-feedback">
          Please wait {state.remaining}s before trying again.
        </p>
      )}
      {state.message && (
        <p role="status" className="voucher-feedback voucher-success">
          {state.message}
        </p>
      )}
      {detail && state.offers[0] ? (
        <VoucherDetailContent
          voucher={state.offers[0]}
          action={action(state.offers[0])}
        />
      ) : (
        <div className="customer-voucher-grid">
          {state.offers.map((voucher) => (
            <VoucherCard
              key={voucher.id}
              voucher={voucher}
              action={action(voucher)}
            />
          ))}
        </div>
      )}
    </>
  );
}
