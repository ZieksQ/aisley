"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@aisley/ui";
import { useAuth } from "@/components/auth/auth-provider";
import { sessionRevision } from "@/lib/auth/session-events";
import { voucherStatuses, VoucherError } from "@/lib/vouchers/client";
import type { CustomerVoucher } from "@/lib/vouchers/types";
import { VoucherOffers } from "./voucher-offers";

export function PrivateVoucherDetail({ id }: { id: string }) {
  const { auth } = useAuth();
  if (auth.status === "loading")
    return <p role="status">Checking voucher access…</p>;
  if (auth.status === "guest") return <Unavailable />;
  return <PersonalDetail key={auth.customer.id} id={id} />;
}

function Unavailable() {
  return (
    <section className="voucher-empty">
      <h1>Voucher unavailable</h1>
      <p>This offer is no longer publicly available.</p>
      <Link className="voucher-details-link" href="/vouchers">
        Discover other vouchers
      </Link>
    </section>
  );
}

function PersonalDetail({ id }: { id: string }) {
  const [result, setResult] = useState<{
    voucher?: CustomerVoucher;
    error?: string;
    retryAt?: number;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const controller = new AbortController();
    const revision = sessionRevision();
    voucherStatuses([id], controller.signal)
      .then((items) => {
        if (!controller.signal.aborted && revision === sessionRevision())
          setResult({ voucher: items.find((item) => item.id === id) });
      })
      .catch((failure) => {
        if (!controller.signal.aborted && revision === sessionRevision())
          setResult({
            error:
              failure instanceof Error
                ? failure.message
                : "Voucher could not be loaded.",
            retryAt: failure instanceof VoucherError ? failure.retryAt : 0,
          });
      });
    return () => controller.abort();
  }, [id, attempt]);
  useEffect(() => {
    if (!result?.retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [result?.retryAt]);
  if (!result) return <p role="status">Loading voucher details…</p>;
  const remaining = result.retryAt
    ? Math.max(0, Math.ceil((result.retryAt - now) / 1000))
    : 0;
  if (result.error)
    return (
      <div className="voucher-feedback">
        <p role="alert">{result.error}</p>
        <Button
          variant="outline"
          disabled={remaining > 0}
          onClick={() => setAttempt((value) => value + 1)}
        >
          {remaining ? `Retry in ${remaining}s` : "Try again"}
        </Button>
      </div>
    );
  if (!result.voucher) return <Unavailable />;
  return (
    <>
      <header className="voucher-page-heading">
        <h1>{result.voucher.name}</h1>
      </header>
      <VoucherOffers items={[result.voucher]} detail privateItems />
    </>
  );
}
