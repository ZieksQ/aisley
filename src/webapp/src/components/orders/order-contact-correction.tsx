import { useEffect, useRef, useState } from "react";
import { Button } from "@aisley/ui";
import { ApiError } from "@/lib/api";
import { fetchAddresses } from "@/lib/checkout/client";
import type { CustomerAddress } from "@/lib/checkout/types";
import { canCorrectOrderContact } from "@/lib/orders/address-correction";
import { fetchOrder, modifyOrderAddress, orderMutationKey } from "@/lib/orders/client";
import type { OrderDetail } from "@/lib/orders/types";
import { OrderContactDialog } from "./order-contact-dialog";

type Props = {
  order: OrderDetail;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onUpdated: (order: OrderDetail) => void;
  onSuccess: (message: string) => void;
};
type Submission = { addressId: string; revision: number; key: string };

export function OrderContactCorrection({ order, disabled, onBusyChange, onUpdated, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const submission = useRef<Submission | null>(null);
  const working = useRef(false);
  const generation = useRef(0);
  useEffect(() => () => {
    generation.current += 1;
  }, []);

  async function show() {
    if (disabled || working.current || open) return;
    const current = ++generation.current;
    setOpen(true);
    setLoading(true);
    setError(null);
    setFieldError(null);
    setAddresses([]);
    setSelectedId(null);
    try {
      const saved = (await fetchAddresses()).filter((address) => canCorrectOrderContact(order.deliveryAddress, address));
      if (generation.current !== current) return;
      setAddresses(saved);
      setSelectedId(saved[0]?.id ?? null);
    } catch (caught) {
      if (generation.current !== current) return;
      setError(caught instanceof ApiError ? caught.message : "We could not load your saved addresses. Close this form and try again.");
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }

  function close() {
    if (working.current || submission.current) return;
    generation.current += 1;
    setOpen(false);
    setAddresses([]);
  }

  async function submit() {
    if (working.current || (disabled && !submission.current) || !selectedId) return;
    if (!navigator.onLine) {
      setError("You are offline. Reconnect before correcting this Order's contact details.");
      return;
    }
    if (!submission.current && !addresses.some((address) => address.id === selectedId && canCorrectOrderContact(order.deliveryAddress, address))) {
      setFieldError("Select a saved contact correction at the same location.");
      return;
    }
    submission.current ??= {
      addressId: selectedId,
      revision: order.deliveryAddress.version,
      key: orderMutationKey(),
    };
    const pending = submission.current;
    const current = generation.current;
    working.current = true;
    setBusy(true);
    setError(null);
    setFieldError(null);
    onBusyChange(true);
    try {
      const updated = await modifyOrderAddress(order.id, pending.addressId, pending.key, pending.revision);
      if (generation.current !== current) return;
      submission.current = null;
      setUncertain(false);
      setOpen(false);
      setAddresses([]);
      onUpdated(updated);
      onSuccess("Delivery contact corrected for this Order.");
    } catch (caught) {
      if (generation.current !== current) return;
      setError(caught instanceof ApiError ? caught.message : "We could not confirm the correction. Check your connection and retry the original request.");
      const rejected = caught instanceof ApiError && (caught.status === 422
        || (caught.status === 409 && caught.code !== "IDEMPOTENCY_KEY_REUSED"));
      if (rejected) {
        submission.current = null;
        setUncertain(false);
        setFieldError(caught.errors.address_id?.[0] ?? caught.errors.expected_revision?.[0] ?? null);
        if (caught.status === 409) {
          try {
            const updated = await fetchOrder(order.id);
            if (generation.current === current) onUpdated(updated);
          } catch {
            // Keep the conflict visible when refresh is unavailable.
          }
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
      <Button
        variant="outline"
        onClick={() => void show()}
        disabled={disabled || open}
        className="!min-h-10 !rounded-md !px-4"
      >
        Correct delivery contact
      </Button>
      {open ? (
        <OrderContactDialog
          reference={order.reference}
          addresses={addresses}
          loading={loading}
          busy={busy}
          uncertain={uncertain}
          selectedId={selectedId}
          error={error}
          fieldError={fieldError}
          onSelect={(id) => {
            if (!working.current && !submission.current) setSelectedId(id);
          }}
          onClose={close}
          onSubmit={() => void submit()}
        />
      ) : null}
    </>
  );
}
