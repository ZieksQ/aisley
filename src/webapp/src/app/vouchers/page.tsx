import type { Metadata } from "next";
import Link from "next/link";
import { PublicReadFailure } from "@/components/search/public-read-failure";
import { VoucherFiltersBar } from "@/components/vouchers/voucher-filters";
import { VoucherOffers } from "@/components/vouchers/voucher-offers";
import { VoucherPagination } from "@/components/vouchers/voucher-pagination";
import { filterParameters, parseVoucherFilters } from "@/lib/vouchers/model";
import { publicVouchers } from "@/lib/vouchers/server";

export const metadata: Metadata = {
  title: "Vouchers",
  description:
    "Discover platform and shop vouchers. Collect offers, browse products and select your savings at checkout.",
  alternates: { canonical: "/vouchers" },
  openGraph: {
    title: "Aisley vouchers",
    description: "Discover and collect platform and shop offers.",
    url: "/vouchers",
  },
  twitter: {
    card: "summary",
    title: "Aisley vouchers",
    description: "Discover and collect platform and shop offers.",
  },
};

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { filters, error } = parseVoucherFilters(await searchParams);
  const result = error
    ? { status: "invalid" as const, message: error }
    : await publicVouchers(filters);
  return (
    <>
      <header className="voucher-page-heading">
        <div>
          <h1>Vouchers</h1>
          <p>Collect offers as you shop. Choose your savings at checkout.</p>
        </div>
        <Link className="voucher-link-button" href="/account/vouchers">
          My Vouchers
        </Link>
      </header>
      <VoucherFiltersBar key={JSON.stringify(filters)} filters={filters} />
      {result.status === "success" ? (
        <>
          <p className="voucher-result-count">
            {result.data.pagination.total} offers · Expiring soonest first
          </p>
          {result.data.items.length ? (
            <VoucherOffers
              items={result.data.items}
              returnPath={`/vouchers?${filterParameters(filters)}`}
            />
          ) : (
            <div className="voucher-empty">
              <h2>No vouchers found</h2>
              <p>Try another filter or check back for new offers.</p>
              <Link className="voucher-details-link" href="/vouchers">
                Reset filters
              </Link>
            </div>
          )}
          <VoucherPagination
            pagination={result.data.pagination}
            filters={filters}
          />
        </>
      ) : (
        <PublicReadFailure result={result} subject="Vouchers">
          <Link className="voucher-details-link" href="/vouchers">
            Reset voucher filters
          </Link>
        </PublicReadFailure>
      )}
    </>
  );
}
