"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@aisley/ui";
import { PublicReadFailure } from "@/components/search/public-read-failure";
import type { PublicApiResult } from "@/lib/marketplace/server";
import { shopVouchers, VoucherError } from "@/lib/vouchers/client";
import type { VoucherPage } from "@/lib/vouchers/types";
import { VoucherOffers } from "./voucher-offers";
import { VoucherPagination } from "./voucher-pagination";

export function ShopVouchersSection({
  slug,
  initial,
  returnPath,
}: {
  slug: string;
  initial: PublicApiResult<VoucherPage>;
  returnPath: string;
}) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: VoucherPage;
    error?: string;
    retryAt?: number;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const key = `${slug}:${page}:${attempt}`;
  useEffect(() => {
    if (page === 1 && attempt === 0) return;
    const controller = new AbortController();
    shopVouchers(slug, page, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, data });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error:
              failure instanceof Error
                ? failure.message
                : "Shop vouchers could not be loaded.",
            retryAt: failure instanceof VoucherError ? failure.retryAt : 0,
          });
      });
    return () => controller.abort();
  }, [key, slug, page, attempt]);
  useEffect(() => {
    if (!result?.retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [result?.retryAt]);
  const current =
    result?.key === key
      ? result
      : page === 1 && attempt === 0 && initial.status === "success"
        ? { data: initial.data }
        : null;
  const remaining =
    current && "retryAt" in current && current.retryAt
      ? Math.max(0, Math.ceil((current.retryAt - now) / 1000))
      : 0;
  return (
    <section
      id="vouchers"
      aria-labelledby="shop-vouchers-heading"
      className="customer-vouchers shop-vouchers-section"
    >
      <div className="shop-vouchers-heading">
        <h2 id="shop-vouchers-heading">Shop vouchers</h2>
        <Link className="voucher-details-link" href="/account/vouchers">
          My Vouchers
        </Link>
      </div>
      {page === 1 && attempt === 0 && initial.status !== "success" ? (
        <PublicReadFailure result={initial} subject="Shop vouchers" />
      ) : !current ? (
        <p role="status" className="voucher-feedback">
          Loading shop vouchers…
        </p>
      ) : "error" in current && current.error ? (
        <div className="voucher-feedback">
          <p role="alert">{current.error}</p>
          <Button
            disabled={remaining > 0}
            onClick={() => setAttempt((value) => value + 1)}
          >
            {remaining ? `Retry in ${remaining}s` : "Try again"}
          </Button>
        </div>
      ) : (
        current.data && (
          <>
            {current.data.items.length ? (
              <VoucherOffers
                items={current.data.items}
                shopSlug={slug}
                returnPath={returnPath}
              />
            ) : (
              <p className="voucher-empty">
                No shop vouchers available at the moment.
              </p>
            )}
            <VoucherPagination
              pagination={current.data.pagination}
              onPage={setPage}
            />
          </>
        )
      )}
    </section>
  );
}
