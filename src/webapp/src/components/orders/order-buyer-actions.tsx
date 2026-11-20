"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@aisley/ui";
import { ApiError } from "@/lib/api";
import { cancelOrder, extendOrderPreparation, orderMutationKey } from "@/lib/orders/client";
import { sessionRevision } from "@/lib/auth/session-events";
import { pendingOrderDecision, saveOrderDecision, type PendingOrderDecision } from "@/lib/orders/pending-mutations";
import { formatOrderDateTime } from "@/lib/orders/format";
import type { OrderDetail } from "@/lib/orders/types";
import { OrderContactCorrection } from "./order-contact-correction";

type Pending = PendingOrderDecision;

export function OrderBuyerActions({ order, stale, onUpdated, onRefresh }: {
  order: OrderDetail;
  stale: boolean;
  onUpdated: (order: OrderDetail) => void;
  onRefresh: () => Promise<void>;
}) {
  const [choice, setChoice] = useState<Pending["kind"] | null>(() => pendingOrderDecision(order.id)?.kind ?? null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Pending | null>(() => pendingOrderDecision(order.id));
  const [busy, setBusy] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revision] = useState(sessionRevision);
  const alive = useRef(false);
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const preparation = order.preparation;
  const blocked = stale || busy || addressBusy || pending !== null;

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!choice) return;
    const element = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (!inFlight.current && !pendingOrderDecision(order.id)) setChoice(null);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      element?.close();
      previous?.focus();
    };
  }, [choice, order.id]);
  useEffect(() => {
    if (!preparation?.active || preparation.overdue || !preparation.deadlineAt) return;
    const remaining = Date.parse(preparation.deadlineAt) - Date.parse(preparation.serverTime);
    // Cap timers to the browser's signed 32-bit limit. Refresh obtains capabilities.
    const timer = window.setTimeout(() => void onRefresh(), Math.min(Math.max(remaining + 100, 100), 2147483647));
    return () => window.clearTimeout(timer);
  }, [preparation, onRefresh]);

  function open(kind: Pending["kind"]) {
    if (blocked || !navigator.onLine) return;
    setChoice(kind);
    setReason("");
    setError(null);
    setSuccess(null);
  }

  async function submit() {
    if (!choice || inFlight.current || addressBusy || !navigator.onLine || (stale && !pending)) return;
    const request = pending ?? { kind: choice, key: orderMutationKey(), reason: reason.trim() };
    inFlight.current = true;
    setBusy(true);
    setPending(request);
    saveOrderDecision(order.id, request);
    setError(null);
    try {
      const updated = request.kind === "extend"
        ? await extendOrderPreparation(order.id, request.key)
        : await cancelOrder(order.id, request.key, request.reason || undefined);
      if (sessionRevision() !== revision) return;
      saveOrderDecision(order.id, null);
      if (!alive.current) return;
      onUpdated(updated);
      setPending(null);
      setChoice(null);
      setSuccess(request.kind === "extend" ? "Preparation extended by 3 days." : "Order cancelled.");
    } catch (caught) {
      if (!alive.current || sessionRevision() !== revision) return;
      const uncertain = !(caught instanceof ApiError) || caught.status >= 500 || caught.status === 408;
      setError(uncertain
        ? "The outcome is unconfirmed. Retry the exact request before making another change."
        : caught.message);
      if (!uncertain && !(caught instanceof ApiError && caught.code === "IDEMPOTENCY_KEY_REUSED")) {
        setPending(null);
        saveOrderDecision(order.id, null);
        if (caught instanceof ApiError && [403, 404, 409].includes(caught.status)) {
          setChoice(null);
          await onRefresh();
        }
      }
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return (
    <>
      {preparation?.acceptedAt && order.status === "seller_processing" ? (
        <section aria-labelledby="preparation-heading" className="mt-4 border border-[#DED7E1] bg-white px-4 py-4 text-sm text-[#514656] sm:px-5">
          <h2 id="preparation-heading" className="text-base font-semibold text-[#2D2231]">Seller preparation</h2>
          <p className="mt-2">{preparation.overdue ? "The seller has missed the preparation deadline." : "The seller has 72 hours to prepare your parcel and request pickup."}</p>
          {preparation.deadlineAt ? <p className="mt-2">{preparation.extensionUsed ? "Extended deadline" : "Preparation deadline"}: <time dateTime={preparation.deadlineAt} className="font-semibold">{formatOrderDateTime(preparation.deadlineAt)}</time> (your local time)</p> : null}
          {preparation.extensionUsed ? <p className="mt-2">Your one-time extension has been used.{preparation.overdue ? " You can cancel while the parcel is still being prepared." : " Cancellation is unavailable until the extended deadline passes."}</p> : preparation.overdue ? <p className="mt-2">Give the seller another 3 days from your approval, or cancel this order. The order stays active until you decide or the seller finishes preparation.</p> : null}
        </section>
      ) : null}
      {error || success ? <p role={error ? "alert" : "status"} className="mt-4 text-sm text-[#4C1268]">{error ?? success}</p> : null}
      {order.actions.canCancel || order.actions.canModify || order.actions.canExtendPreparation || pending ? (
        <section aria-label="Order actions" className="mt-4 flex flex-wrap gap-3 border border-[#DED7E1] bg-white px-4 py-4 sm:px-5">
          {order.actions.canExtendPreparation && preparation ? <Button variant="secondary" onClick={() => open("extend")} disabled={blocked} className="!min-h-11 !shadow-none">Extend preparation by 3 days</Button> : null}
          {order.actions.canCancel ? <Button variant="outline" onClick={() => open("cancel")} disabled={blocked} className="!min-h-11">Cancel Order</Button> : null}
          {order.actions.canModify && order.actions.modifiableFields.includes("delivery_address") ? <OrderContactCorrection order={order} disabled={blocked} onBusyChange={setAddressBusy} onUpdated={onUpdated} onSuccess={setSuccess} /> : null}
          {pending ? <Button variant="outline" onClick={() => setChoice(pending.kind)} disabled={busy} className="!min-h-11">Review unresolved change</Button> : null}
          {stale ? <p className="w-full text-sm text-[#514656]">Refresh the order before making changes.</p> : null}
        </section>
      ) : null}
      {choice ? (
        <dialog ref={dialog} aria-labelledby="order-decision-heading" onCancel={(event) => { event.preventDefault(); if (!busy && !pending) setChoice(null); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-3rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto border border-[#DED7E1] bg-white p-5 text-[#2D2231] backdrop:bg-black/45 sm:p-6">
          <h2 id="order-decision-heading" className="text-lg font-semibold">{choice === "extend" ? "Extend preparation" : "Cancel Order"} {order.reference}?</h2>
          <p className="mt-3 text-sm leading-6">{choice === "extend" ? "Give the seller one additional 72-hour window starting when your approval commits. You cannot cancel during this extension. If the seller misses it, you can cancel. This extension can only be used once." : "This cancels this Shop Order only. This is a cash-on-delivery order; no payment reversal is needed."}</p>
          {choice === "cancel" ? <label className="mt-4 block text-sm">Reason (optional)<textarea value={pending?.reason ?? reason} onChange={(event) => setReason(event.target.value)} disabled={busy || pending !== null} maxLength={500} rows={3} className="mt-2 w-full border border-[#CFC6D2] p-3" /></label> : null}
          {error ? <p role="alert" className="mt-3 text-sm text-[#9D174D]">{error}</p> : null}
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            <Button variant="outline" autoFocus onClick={() => setChoice(null)} disabled={busy || pending !== null} className="!min-h-11">Keep Order</Button>
            <Button variant="secondary" onClick={() => void submit()} disabled={busy || (stale && !pending)} className="!min-h-11 !shadow-none">{busy ? "Updating…" : pending ? "Retry exact request" : choice === "extend" ? "Confirm 3-day extension" : "Confirm cancellation"}</Button>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
