"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@aisley/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { sessionRevision } from "@/lib/auth/session-events";
import { myVouchers, VoucherError } from "@/lib/vouchers/client";
import type { VoucherFilters, VoucherPage } from "@/lib/vouchers/types";
import { VoucherOffers } from "./voucher-offers";
import { VoucherPagination } from "./voucher-pagination";

export function MyVouchersContent() {
  const { auth } = useAuth();
  if (auth.status !== "authenticated")
    return <p role="status">Checking your account…</p>;
  return <Wallet key={auth.customer.id} />;
}

function Wallet() {
  const [filters, setFilters] = useState<VoucherFilters>({
    status: "available",
    page: 1,
  });
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: VoucherPage;
    error?: string;
    retryAt?: number;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const key = JSON.stringify([filters, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    const revision = sessionRevision();
    myVouchers(filters, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted && revision === sessionRevision())
          setResult({ key, data });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && revision === sessionRevision())
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : "Your vouchers could not be loaded.",
            retryAt: error instanceof VoucherError ? error.retryAt : 0,
          });
      });
    return () => controller.abort();
  }, [filters, key]);
  useEffect(() => {
    if (!result?.retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [result?.retryAt]);
  const current = result?.key === key ? result : null;
  const remaining = current?.retryAt
    ? Math.max(0, Math.ceil((current.retryAt - now) / 1000))
    : 0;
  return (
    <section className="customer-vouchers voucher-wallet">
      <header className="voucher-page-heading">
        <div>
          <h1>My Vouchers</h1>
          <p>Collected offers and automatically available platform vouchers.</p>
        </div>
        <Link className="voucher-link-button" href="/vouchers">
          Discover vouchers
        </Link>
      </header>
      <div className="voucher-filters">
        <nav aria-label="Voucher status" className="voucher-filter-tabs">
          {(["available", "upcoming", "history"] as const).map((status) => (
            <button
              key={status}
              aria-pressed={filters.status === status}
              onClick={() =>
                setFilters((previous) => ({ ...previous, status, page: 1 }))
              }
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </nav>
        <div className="voucher-benefit-filter">
          <label htmlFor="wallet-issuer">Issuer</label>
          <select
            id="wallet-issuer"
            value={filters.issuer ?? ""}
            onChange={(event) =>
              setFilters((previous) => ({
                ...previous,
                issuer: event.target.value
                  ? (event.target.value as "app" | "shop")
                  : undefined,
                page: 1,
              }))
            }
          >
            <option value="">All issuers</option>
            <option value="app">Platform</option>
            <option value="shop">Shop</option>
          </select>
        </div>
      </div>
      {!current ? (
        <p role="status" className="voucher-feedback">
          Loading your vouchers…
        </p>
      ) : current.error ? (
        <div className="voucher-feedback">
          <p role="alert">{current.error}</p>
          <Button
            variant="outline"
            disabled={remaining > 0}
            onClick={() => setAttempt((value) => value + 1)}
          >
            {remaining ? `Retry in ${remaining}s` : "Try again"}
          </Button>
        </div>
      ) : (
        current.data && (
          <>
            <p role="status" className="voucher-result-count">
              {current.data.pagination.total} voucher
              {current.data.pagination.total === 1 ? "" : "s"}
            </p>
            {current.data.items.length ? (
              <VoucherOffers items={current.data.items} privateItems />
            ) : (
              <div className="voucher-empty">
                <h2>No vouchers here yet</h2>
                <p>
                  {filters.status === "history"
                    ? "Expired, ended or fully used vouchers will appear here."
                    : "Discover platform offers or visit a shop to collect its vouchers."}
                </p>
                <Link className="voucher-details-link" href="/vouchers">
                  Browse vouchers
                </Link>
              </div>
            )}
            <VoucherPagination
              pagination={current.data.pagination}
              onPage={(page) =>
                setFilters((previous) => ({ ...previous, page }))
              }
            />
          </>
        )
      )}
    </section>
  );
}
