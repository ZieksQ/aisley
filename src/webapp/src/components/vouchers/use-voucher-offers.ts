"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { sessionRevision } from "@/lib/auth/session-events";
import {
  collectVoucher,
  voucherStatuses,
  VoucherError,
} from "@/lib/vouchers/client";
import { availabilityReasons } from "@/lib/vouchers/model";
import type { CustomerVoucher } from "@/lib/vouchers/types";

// The consuming view is keyed by verified identity. Unmount invalidates every private reply.
export function useVoucherOffers(
  initial: CustomerVoucher[],
  owner: string | null,
  shopSlug?: string,
  privateItems = false,
) {
  const router = useRouter();
  const [items, setItems] = useState(privateItems ? initial : null);
  const [error, setError] = useState("");
  const [consentRequired, setConsentRequired] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const alive = useRef(true);
  const pending = useRef(false);
  const ids = initial.map((voucher) => voucher.id).join(",");

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!owner || privateItems || !ids) return;
    const controller = new AbortController();
    const revision = sessionRevision();
    voucherStatuses(ids.split(","), controller.signal)
      .then((response) => {
        if (!controller.signal.aborted && revision === sessionRevision()) {
          setItems(response);
          setError("");
          setConsentRequired(false);
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted && revision === sessionRevision()) {
          setItems(null);
          setConsentRequired(
            failure instanceof ApiError &&
              failure.code === "POLICY_CONSENT_REQUIRED",
          );
          setError(
            failure instanceof Error
              ? failure.message
              : "Your voucher status could not be checked.",
          );
          if (failure instanceof VoucherError) setRetryAt(failure.retryAt);
        }
      });
    return () => controller.abort();
  }, [owner, ids, attempt, privateItems]);

  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  async function collect(voucher: CustomerVoucher) {
    if (pending.current) return;
    pending.current = true;
    const revision = sessionRevision();
    setBusy(voucher.id);
    setError("");
    setMessage("");
    try {
      const updated = await collectVoucher(voucher, shopSlug);
      if (!alive.current || revision !== sessionRevision()) return;
      setItems((previous) => [
        ...(previous ?? initial).filter((item) => item.id !== updated.id),
        updated,
      ]);
      setMessage(
        `${updated.name} collected. Browse products, then select it at checkout.`,
      );
    } catch (failure) {
      if (!alive.current || revision !== sessionRevision()) return;
      if (
        failure instanceof ApiError &&
        failure.code === "POLICY_CONSENT_REQUIRED"
      ) {
        const next = `${window.location.pathname}${window.location.search}${shopSlug ? "#vouchers" : ""}`;
        router.push(`/account/policy-consent?next=${encodeURIComponent(next)}`);
      }
      const reason =
        failure instanceof ApiError
          ? availabilityReasons[failure.code ?? ""]
          : null;
      setError(
        reason ??
          (failure instanceof Error && failure.name !== "TimeoutError"
            ? failure.message
            : "Collection was not confirmed. Check your connection and retry Collect safely."),
      );
      if (failure instanceof VoucherError) setRetryAt(failure.retryAt);
    } finally {
      pending.current = false;
      if (alive.current && revision === sessionRevision()) setBusy(null);
    }
  }

  const waiting =
    owner !== null && !privateItems && ids !== "" && items === null;
  const offers = initial.map(
    (voucher) =>
      items?.find((item) => item.id === voucher.id) ??
      (owner && items !== null
        ? {
            ...voucher,
            canCollect: false,
            availabilityReason: "VOUCHER_CUSTOMER_INELIGIBLE",
          }
        : voucher),
  );
  const remaining = retryAt
    ? Math.max(0, Math.ceil((retryAt - now) / 1000))
    : 0;
  return {
    offers,
    waiting,
    error,
    consentRequired,
    message,
    busy,
    remaining,
    collect,
    retry: () => setAttempt((value) => value + 1),
  };
}
