import Link from "next/link";
import { Button } from "@aisley/ui";
import type { CustomerVoucher } from "@/lib/vouchers/types";
import {
  availabilityReasons,
  benefit,
  money,
  voucherDate,
} from "@/lib/vouchers/model";

export function VoucherAction({
  voucher,
  owner,
  shopSlug,
  disabled,
  busy,
  onCollect,
  returnPath,
}: {
  voucher: CustomerVoucher;
  owner: string | null;
  shopSlug?: string;
  disabled: boolean;
  busy: boolean;
  returnPath?: string;
  onCollect: (voucher: CustomerVoucher) => void;
}) {
  const shopLink = voucher.shop
    ? `/shops/${encodeURIComponent(voucher.shop.slug)}`
    : "/";
  if (voucher.issuerType === "shop" && !voucher.shop)
    return (
      <span className="voucher-unavailable">Issuing shop unavailable</span>
    );
  if (voucher.collected || voucher.distributionMode === "automatic")
    return (
      <div className="voucher-action-ready">
        <span>
          {voucher.collected ? "Collected" : "Automatically available"}
        </span>
        <Link className="voucher-link-button" href={shopLink}>
          Shop now
        </Link>
      </div>
    );
  if (voucher.issuerType === "shop" && !shopSlug)
    return (
      <Link className="voucher-link-button" href={`${shopLink}#vouchers`}>
        Visit shop to collect
      </Link>
    );
  if (!voucher.canCollect)
    return <span className="voucher-unavailable">Currently unavailable</span>;
  if (!owner && disabled)
    return (
      <Button disabled className="voucher-collect">
        Collect
      </Button>
    );
  if (!owner) {
    const origin =
      returnPath ??
      (shopSlug
        ? `/shops/${encodeURIComponent(shopSlug)}#vouchers`
        : `/vouchers/${voucher.id}`);
    return (
      <Link
        className="voucher-link-button voucher-collect"
        href={`/login?next=${encodeURIComponent(origin)}`}
      >
        Collect
      </Link>
    );
  }
  return (
    <Button
      type="button"
      className="voucher-collect"
      disabled={disabled}
      isLoading={busy}
      loadingLabel="Collecting…"
      onClick={() => onCollect(voucher)}
    >
      {busy ? "Collecting…" : "Collect"}
    </Button>
  );
}

export function VoucherCard({
  voucher,
  action,
}: {
  voucher: CustomerVoucher;
  action: React.ReactNode;
}) {
  return (
    <article className="customer-voucher-card">
      <div
        className={`voucher-benefit-panel ${voucher.benefitType === "shipping" ? "voucher-shipping" : ""}`}
      >
        <strong>{benefit(voucher)}</strong>
        <span>
          {voucher.benefitType === "shipping"
            ? "shipping saving"
            : "off merchandise"}
        </span>
        <span>{voucher.issuerType === "app" ? "Platform" : "Shop"}</span>
      </div>
      <div className="voucher-card-body">
        <h3>{voucher.name}</h3>
        <p className="voucher-issuer">
          {voucher.shop?.name ??
            (voucher.issuerType === "app" ? "Aisley" : "Shop offer")}
        </p>
        <p>
          Min. spend {money(voucher.minimumSpend)}
          {voucher.maximumDiscount
            ? ` · Cap ${money(voucher.maximumDiscount)}`
            : ""}
        </p>
        <p className="voucher-date">Ends {voucherDate(voucher.validUntil)}</p>
        {voucher.remainingPersonalUses !== null && (
          <p>
            {voucher.remainingPersonalUses} use
            {voucher.remainingPersonalUses === 1 ? "" : "s"} remaining
          </p>
        )}
        {voucher.availabilityReason && (
          <p className="voucher-reason">
            {availabilityReasons[voucher.availabilityReason] ??
              "This voucher is unavailable."}
          </p>
        )}
        <Link className="voucher-details-link" href={`/vouchers/${voucher.id}`}>
          View details and terms
        </Link>
      </div>
      <div className="voucher-card-action">{action}</div>
    </article>
  );
}
