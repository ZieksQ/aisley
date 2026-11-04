import { useEffect, useRef, useState } from "react";
import { Button } from "@aisley/ui";
import { ApiError } from "@/lib/api";
import { fetchAddresses } from "@/lib/checkout/client";
import type { CustomerAddress } from "@/lib/checkout/types";
import { isCurrentOrderAddress } from "@/lib/orders/address-correction";
import { fetchOrder, modifyOrderAddress, orderMutationKey, quoteOrderAddress } from "@/lib/orders/client";
import type { OrderAddressQuote, OrderDetail } from "@/lib/orders/types";
import { OrderContactDialog } from "./order-contact-dialog";

type Props = {
  order: OrderDetail;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onUpdated: (order: OrderDetail) => void;
  onSuccess: (message: string) => void;
};
type Submission = { addressId: string; revision: number; key: string; quoteId: string };

export function OrderContactCorrection({ order, disabled, onBusyChange, onUpdated, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quote, setQuote] = useState<OrderAddressQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const submission = useRef<Submission | null>(null);
  const working = useRef(false);
  const generation = useRef(0);
  const chosenId = useRef<string | null>(null);
  useEffect(() => () => { generation.current += 1; }, []);

  async function show() {
    if (disabled || working.current || open) return;
    const current = ++generation.current;
    setOpen(true);
    setLoading(true);
    setError(null);
    setFieldError(null);
    setQuote(null);
    setAddresses([]);
    setSelectedId(null);
    chosenId.current = null;
    try {
      const saved = (await fetchAddresses()).filter(address => address.type !== "billing");
      if (generation.current !== current) return;
      setAddresses(saved);
    } catch (caught) {
      if (generation.current !== current) return;
      setError(caught instanceof ApiError ? caught.message : "We could not load saved addresses. Close this dialog and try again.");
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }

  function close() {
    if (working.current || submission.current) return;
    generation.current += 1;
    setOpen(false);
    setAddresses([]);
    setQuote(null);
  }

  function select(id: string) {
    if (working.current || submission.current) return;
    chosenId.current = id;
    setSelectedId(id);
    setQuote(null);
    setError(null);
    setFieldError(null);
  }

  async function refreshAfterConflict() {
    const current = generation.current;
    try {
      const updated = await fetchOrder(order.id);
      if (generation.current === current) onUpdated(updated);
    } catch { /* Keep the original error visible if refresh fails. */ }
  }

  async function submit() {
    if (working.current || (disabled && !submission.current) || !selectedId) return;
    if (!navigator.onLine) {
      setError("You are offline. Reconnect before changing the delivery address.");
      return;
    }
    const selected = addresses.find(address => address.id === selectedId);
    if (!submission.current && (!selected || isCurrentOrderAddress(order.deliveryAddress, selected))) return;
    if (!submission.current && quote && Date.parse(quote.expiresAt) <= Date.now()) {
      setQuote(null);
      setError("This quote expired. Review the delivery total again before confirming.");
      return;
    }
    const current = generation.current;
    working.current = true;
    setBusy(true);
    setError(null);
    setFieldError(null);
    onBusyChange(true);
    try {
      if (!submission.current && !quote) {
        const reviewed = await quoteOrderAddress(order.id, selectedId, order.deliveryAddress.version);
        if (generation.current === current && chosenId.current === selectedId) setQuote(reviewed);
        return;
      }
      submission.current ??= {
        addressId: selectedId, revision: quote!.expectedRevision,
        key: orderMutationKey(), quoteId: quote!.quoteId,
      };
      const pending = submission.current;
      const updated = await modifyOrderAddress(order.id, pending.addressId, pending.key, pending.revision, pending.quoteId);
      if (generation.current !== current) return;
      submission.current = null;
      setUncertain(false);
      setOpen(false);
      setAddresses([]);
      setQuote(null);
      onUpdated(updated);
      onSuccess("Delivery address changed for this order.");
    } catch (caught) {
      if (generation.current !== current) return;
      setError(caught instanceof ApiError ? caught.message : submission.current
        ? "We could not confirm the change. Retry the original request before making another change."
        : "We could not calculate delivery. Try reviewing this address again.");
      const rejected = caught instanceof ApiError && [401, 403, 404, 422].includes(caught.status)
        || caught instanceof ApiError && caught.status === 409 && caught.code !== "IDEMPOTENCY_KEY_REUSED";
      if (rejected || !submission.current) {
        submission.current = null;
        setUncertain(false);
        setQuote(null);
        if (caught instanceof ApiError) {
          setFieldError(caught.errors.address_id?.[0] ?? caught.errors.expected_revision?.[0] ?? caught.errors.quote_id?.[0] ?? null);
          if (caught.status === 409) await refreshAfterConflict();
        }
      } else {
        setUncertain(true);
      }
    } finally {
      working.current = false;
      if (generation.current === current) {
        setBusy(false);
        onBusyChange(submission.current !== null);
      }
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => void show()} disabled={disabled || open} className="!min-h-11 !rounded-md !px-4">
        Change delivery address
      </Button>
      {open ? (
        <OrderContactDialog
          reference={order.reference} addresses={addresses} currentAddress={order.deliveryAddress}
          loading={loading} busy={busy} uncertain={uncertain} selectedId={selectedId}
          quote={quote} error={error} fieldError={fieldError}
          onSelect={select} onClose={close} onSubmit={() => void submit()}
        />
      ) : null}
    </>
  );
}
