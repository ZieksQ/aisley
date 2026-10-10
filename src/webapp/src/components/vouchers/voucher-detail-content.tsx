import Link from "next/link";
import type { CustomerVoucher } from "@/lib/vouchers/types";
import {
  availabilityReasons,
  benefit,
  money,
  voucherDate,
} from "@/lib/vouchers/model";

export function VoucherDetailContent({
  voucher,
  action,
}: {
  voucher: CustomerVoucher;
  action: React.ReactNode;
}) {
  const scope = voucher.scope;
  const restricted = Object.values(scope).some((ids) => ids.length > 0);
  return (
    <div className="voucher-detail-layout">
      <article className="voucher-detail-terms">
        <h2>Conditions</h2>
        <dl>
          <dt>Minimum spend</dt>
          <dd>
            {money(voucher.minimumSpend)} in one shop, before voucher discounts
          </dd>
          <dt>Savings cap</dt>
          <dd>
            {voucher.maximumDiscount
              ? money(voucher.maximumDiscount)
              : "No additional cap; savings cannot exceed the eligible amount"}
          </dd>
          <dt>Valid from</dt>
          <dd>{voucherDate(voucher.validFrom)} (Asia/Manila)</dd>
          <dt>Valid until</dt>
          <dd>{voucherDate(voucher.validUntil)} (Asia/Manila)</dd>
          <dt>Payment</dt>
          <dd>
            {voucher.paymentMethod === "cod" || voucher.paymentMethod === null
              ? "Cash on delivery"
              : "See payment restriction"}
          </dd>
          <dt>Applies to</dt>
          <dd>
            {voucher.shop
              ? voucher.shop.name
              : voucher.issuerType === "app"
                ? "An eligible shop selected at checkout"
                : "Issuing shop"}
            {restricted
              ? " · Selected products or categories"
              : " · All eligible products"}
          </dd>
          <dt>Combining vouchers</dt>
          <dd>
            One merchandise discount and one shipping voucher per shop order.
            Platform vouchers require an explicit shop choice at checkout.
          </dd>
          <dt>Distribution</dt>
          <dd>
            {voucher.distributionMode === "automatic"
              ? "Automatically available to eligible accounts"
              : "Collect before selecting at checkout"}
          </dd>
          <dt>Code</dt>
          <dd>{voucher.code}</dd>
        </dl>
        {restricted && (
          <details className="voucher-scope">
            <summary>Applicable product and category references</summary>
            {Object.entries(scope)
              .filter(([, ids]) => ids.length)
              .map(([label, ids]) => (
                <p key={label}>
                  {
                    (
                      {
                        productIds: "Included products",
                        categoryIds: "Included categories",
                        excludedProductIds: "Excluded products",
                        excludedCategoryIds: "Excluded categories",
                      } as Record<string, string>
                    )[label]
                  }
                  : {ids.join(", ")}
                </p>
              ))}
          </details>
        )}
        <h2>Terms</h2>
        <p className="voucher-plain-terms">
          {voucher.termsSummary ||
            "Eligibility and available uses are checked again at checkout."}
        </p>
      </article>
      <aside
        className="voucher-detail-action"
        aria-label="Voucher benefit and collection"
      >
        <p className="voucher-detail-benefit">{benefit(voucher)}</p>
        <p>
          {voucher.benefitType === "shipping"
            ? "shipping saving"
            : "off merchandise"}
        </p>
        <p className="voucher-detail-issuer">
          {voucher.shop?.name ?? "Aisley platform voucher"}
        </p>
        {voucher.availabilityReason && (
          <p className="voucher-reason">
            {availabilityReasons[voucher.availabilityReason] ??
              "Currently unavailable"}
          </p>
        )}
        {voucher.remainingPersonalUses !== null && (
          <p>{voucher.remainingPersonalUses} personal uses remaining</p>
        )}
        {action}
        <p>
          Collect, browse products, then select at checkout. Collection does not
          reserve a redemption.
        </p>
        <Link className="voucher-details-link" href="/account/vouchers">
          My Vouchers
        </Link>
      </aside>
    </div>
  );
}
