import Link from "next/link";
import { FiCheck, FiTruck } from "react-icons/fi";
import type { CheckoutVoucher } from "@/lib/checkout/types";
import { amount, voucherReasons } from "./checkout-display";

const expiry = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Manila",
});

export function VoucherTicket({
  voucher,
  selected,
  disabled,
  onSelect,
}: {
  voucher: CheckoutVoucher;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const shipping = voucher.benefitType === "shipping";
  const benefit =
    voucher.valueType === "percent"
      ? `${Number(voucher.value)}%`
      : amount(voucher.value);
  return (
    <article
      className="checkout-voucher-ticket"
      data-selected={selected}
      data-unavailable={!voucher.eligible}
    >
      <button
        type="button"
        className="checkout-voucher-ticket-button"
        aria-pressed={selected}
        aria-label={`${selected ? "Remove" : "Select"} ${voucher.name || voucher.code}`}
        disabled={disabled || (!voucher.eligible && !selected)}
        onClick={onSelect}
      >
        <span className="checkout-voucher-benefit" data-shipping={shipping}>
          {shipping ? <FiTruck aria-hidden="true" /> : null}
          <strong>{benefit}</strong>
          <span>{shipping ? "Shipping off" : "Off"}</span>
        </span>
        <span className="checkout-voucher-conditions">
          <strong className="checkout-voucher-name">
            {voucher.name || voucher.code}
          </strong>
          <span>Min. spend {amount(voucher.minimumSpend)}</span>
          {voucher.maximumDiscount ? (
            <span>Capped at {amount(voucher.maximumDiscount)}</span>
          ) : null}
          <span className="checkout-voucher-expiry">
            Until {expiry.format(new Date(voucher.validUntil))}
          </span>
          {selected ? (
            <span className="checkout-voucher-selected">
              <FiCheck aria-hidden="true" /> Selected
            </span>
          ) : null}
        </span>
      </button>
      {!voucher.eligible && voucher.reason ? (
        <p className="checkout-voucher-reason">
          {voucherReasons[voucher.reason] ?? "Unavailable for this order."}
        </p>
      ) : null}
      <div className="checkout-voucher-links">
        <Link href={`/vouchers/${encodeURIComponent(voucher.id)}`}>
          Details
        </Link>
        {voucher.reason === "VOUCHER_NOT_CLAIMED" &&
        voucher.collectionUrl &&
        !disabled ? (
          <Link href={voucher.collectionUrl}>Collect voucher</Link>
        ) : null}
      </div>
    </article>
  );
}
