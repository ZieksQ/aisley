"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  FiCheck,
  FiChevronDown,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";
import { useCart } from "@/components/cart/cart-provider";
import { ApiError } from "@/lib/api";
import {
  fetchAddresses,
  placeCheckout,
  quoteCheckout,
} from "@/lib/checkout/client";
import {
  checkoutPayloadForIntent,
  clearCheckoutIntent,
  readCheckoutIntent,
} from "@/lib/checkout/intent";
import type {
  CheckoutIntent,
  CheckoutQuote,
  CheckoutRequestPayload,
  CheckoutVoucher,
  CustomerAddress,
  VoucherSelection,
} from "@/lib/checkout/types";

import { AddressForm } from "./address-form";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

const voucherReasons: Record<string, string> = {
  VOUCHER_CUSTOMER_INELIGIBLE: "This voucher is not available for your account.",
  VOUCHER_CUSTOMER_LIMIT: "You have already used this voucher.",
  VOUCHER_EXHAUSTED: "This voucher has reached its usage limit.",
  VOUCHER_EXPIRED: "This voucher has expired.",
  VOUCHER_INACTIVE: "This voucher is currently inactive.",
  VOUCHER_ITEMS_INELIGIBLE: "The selected products are not eligible.",
  VOUCHER_MINIMUM_SPEND: "This Shop order does not meet the minimum spend.",
  VOUCHER_NOT_STARTED: "This voucher is not available yet.",
  VOUCHER_PAYMENT_INELIGIBLE: "This voucher is not available for COD.",
  VOUCHER_TERMS_INVALID: "This voucher is temporarily unavailable.",
};

function amount(value: string) {
  return money.format(Number(value));
}

function addressSummary(address: CustomerAddress) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.barangay,
    address.cityMunicipality,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function payload(
  intent: CheckoutIntent,
  addressId: string,
  vouchers: VoucherSelection[],
): CheckoutRequestPayload {
  return { ...checkoutPayloadForIntent(intent, addressId), vouchers };
}

export function CheckoutPageContent({
  geoapifyApiKey,
}: {
  geoapifyApiKey: string;
}) {
  const router = useRouter();
  const { auth } = useAuth();
  const { refresh: refreshCart } = useCart();
  const quoteSequence = useRef(0);
  const idempotencyKey = useRef<string | null>(null);
  const [intent, setIntent] = useState<CheckoutIntent | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedVouchers, setSelectedVouchers] = useState<VoucherSelection[]>([]);
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "quoting" | "placing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  async function loadQuote(
    nextIntent: CheckoutIntent,
    addressId: string,
    vouchers: VoucherSelection[],
  ) {
    const sequence = ++quoteSequence.current;
    setStatus("quoting");
    setMessage(null);
    try {
      const nextQuote = await quoteCheckout(payload(nextIntent, addressId, vouchers));
      if (sequence !== quoteSequence.current) return null;
      setQuote(nextQuote);
      setSelectedVouchers(vouchers);
      setStatus("ready");
      idempotencyKey.current = null;
      return nextQuote;
    } catch (caught) {
      if (sequence !== quoteSequence.current) return null;
      const error = caught instanceof ApiError ? caught : null;
      setMessage(
        error?.status === 409
          ? `Your checkout changed: ${error.message}`
          : error?.message ?? "We could not prepare this checkout.",
      );
      setStatus("error");
      return null;
    }
  }

  useEffect(() => {
    if (auth.status === "guest") {
      router.replace(`/login?next=${encodeURIComponent("/checkout")}`);
      return;
    }
    if (auth.status !== "authenticated") return;

    const nextIntent = readCheckoutIntent();
    if (!nextIntent) {
      setStatus("error");
      setMessage("Your checkout selection is missing or expired. Return to your cart or a product page to start again.");
      return;
    }

    const controller = new AbortController();
    setIntent(nextIntent);
    fetchAddresses(controller.signal)
      .then(async (items) => {
        const shippingAddresses = items.filter((item) => item.type !== "billing");
        setAddresses(shippingAddresses);
        const selected =
          shippingAddresses.find((item) => item.isDefault) ?? shippingAddresses[0];
        if (!selected) {
          setShowAddressForm(true);
          setStatus("ready");
          return;
        }
        setSelectedAddressId(selected.id);
        await loadQuote(nextIntent, selected.id, []);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setStatus("error");
        setMessage(caught instanceof ApiError ? caught.message : "We could not load your saved addresses.");
      });

    return () => controller.abort();
    // This initialization intentionally runs only when the authenticated customer changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, router]);

  if (auth.status !== "authenticated" || status === "loading") {
    return <CheckoutLoading />;
  }

  if (!intent) {
    return <MissingIntent message={message} />;
  }

  async function chooseAddress(addressId: string) {
    if (!intent || addressId === selectedAddressId) return;
    setSelectedAddressId(addressId);
    setSelectedVouchers([]);
    setQuote(null);
    await loadQuote(intent, addressId, []);
  }

  function findVoucher(voucherId: string) {
    return quote?.groups
      .flatMap((group) => group.availableVouchers)
      .find((voucher) => voucher.id === voucherId);
  }

  async function toggleVoucher(
    voucher: CheckoutVoucher,
    targetShopId: string,
  ) {
    if (!intent || !selectedAddressId || !voucher.eligible) return;
    const alreadySelected = selectedVouchers.some(
      (item) =>
        item.voucher_id === voucher.id && item.target_shop_id === targetShopId,
    );
    let next = alreadySelected
      ? selectedVouchers.filter(
          (item) =>
            item.voucher_id !== voucher.id ||
            item.target_shop_id !== targetShopId,
        )
      : selectedVouchers.filter((item) => {
          const selectedVoucher = findVoucher(item.voucher_id);
          if (voucher.issuerType === "app" && selectedVoucher?.issuerType === "app") {
            return false;
          }
          return !(
            item.target_shop_id === targetShopId &&
            selectedVoucher?.benefitType === voucher.benefitType
          );
        });

    if (!alreadySelected) {
      next = [
        ...next,
        { voucher_id: voucher.id, target_shop_id: targetShopId },
      ];
    }
    await loadQuote(intent, selectedAddressId, next);
  }

  async function placeOrder() {
    if (!intent || !selectedAddressId || !quote) return;
    setStatus("placing");
    setMessage(null);
    idempotencyKey.current ??= crypto.randomUUID();

    try {
      const batch = await placeCheckout(
        {
          ...payload(intent, selectedAddressId, selectedVouchers),
          quote_id: quote.quoteId,
        },
        idempotencyKey.current,
      );
      clearCheckoutIntent();
      try {
        await refreshCart();
      } catch {
        // Placement is complete even when the navbar Cart refresh cannot finish.
      }
      router.replace(`/checkout/result/${batch.id}`);
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : null;
      if (error?.status === 409) {
        setMessage(`${error.message} We refreshed the checkout for review.`);
        const refreshed = await loadQuote(intent, selectedAddressId, selectedVouchers);
        if (!refreshed && selectedVouchers.length > 0) {
          await loadQuote(intent, selectedAddressId, []);
        }
      } else {
        setMessage(error?.message ?? "We could not place your order. You can safely try again.");
        setStatus("ready");
      }
    }
  }

  const selectedAddress = addresses.find((item) => item.id === selectedAddressId);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <section className="border border-[#DED7E1] bg-white p-4 sm:p-5" aria-labelledby="delivery-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="delivery-heading" className="text-base font-semibold text-[#2D2231]">Delivery address</h2>
            {!showAddressForm ? (
              <button type="button" onClick={() => setShowAddressForm(true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">
                <FiPlus aria-hidden="true" className="size-4" /> Add address
              </button>
            ) : null}
          </div>

          {addresses.length > 0 ? (
            <fieldset className="mt-4 grid gap-3">
              <legend className="sr-only">Choose a delivery address</legend>
              {addresses.map((address) => (
                <label key={address.id} className={`flex cursor-pointer gap-3 border p-3.5 ${selectedAddressId === address.id ? "border-[#E6007A] bg-[#FFF7FB]" : "border-[#DDD5E0] hover:border-[#A897AE]"}`}>
                  <input type="radio" name="delivery-address" checked={selectedAddressId === address.id} onChange={() => void chooseAddress(address.id)} className="mt-1 size-4 accent-[#E6007A]" />
                  <span className="min-w-0 text-sm">
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-[#302534]">
                      {address.label || "Delivery address"}
                      {address.isDefault ? <span className="text-xs font-medium text-[#6D1748]">Default</span> : null}
                    </span>
                    <span className="mt-1 block text-[#514656]">{address.recipientName} · {address.contactNumber}</span>
                    <span className="mt-1 block leading-5 text-[#746978]">{addressSummary(address)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : !showAddressForm ? (
            <p className="mt-4 text-sm text-[#665A6A]">Add a delivery address to continue.</p>
          ) : null}

          {showAddressForm ? (
            <div className="mt-4">
              <AddressForm
                geoapifyApiKey={geoapifyApiKey}
                onCancel={addresses.length > 0 ? () => setShowAddressForm(false) : undefined}
                onCreated={(address) => {
                  setAddresses((current) => [address, ...current.map((item) => address.isDefault ? { ...item, isDefault: false } : item)]);
                  setSelectedAddressId(address.id);
                  setShowAddressForm(false);
                  setSelectedVouchers([]);
                  void loadQuote(intent, address.id, []);
                }}
              />
            </div>
          ) : null}
        </section>

        <section className="border border-[#DED7E1] bg-white p-4 sm:p-5" aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="text-base font-semibold text-[#2D2231]">Payment</h2>
          <div className="mt-3 flex items-start gap-3 border border-[#E6007A] bg-[#FFF7FB] p-3.5">
            <span className="mt-0.5 grid size-5 place-items-center rounded-full bg-[#E6007A] text-white"><FiCheck aria-hidden="true" className="size-3.5" /></span>
            <div><p className="text-sm font-semibold text-[#302534]">Cash on delivery</p><p className="mt-1 text-xs leading-5 text-[#746978]">Pay when your order is delivered. Other payment methods are not available yet.</p></div>
          </div>
        </section>

        {quote?.groups.map((group) => (
          <ShopCheckoutGroup
            key={group.shop.id}
            group={group}
            disabled={status === "quoting" || status === "placing"}
            selectedVouchers={selectedVouchers}
            onToggleVoucher={toggleVoucher}
          />
        ))}

        {selectedAddress && !quote && status !== "quoting" ? (
          <button type="button" onClick={() => void loadQuote(intent, selectedAddress.id, selectedVouchers)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] bg-white px-4 text-sm font-semibold text-[#4C1268]">
            <FiRefreshCw aria-hidden="true" /> Refresh checkout
          </button>
        ) : null}
      </div>

      <aside className="border border-[#DED7E1] bg-white p-5 lg:sticky lg:top-32" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="text-base font-semibold text-[#2D2231]">Order summary</h2>
        {quote ? (
          <>
            <dl className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Merchandise" value={amount(quote.summary.merchandiseSubtotal)} />
              <SummaryRow label="Shipping" value={amount(quote.summary.shippingFee)} />
              {Number(quote.summary.discount) > 0 ? <SummaryRow label="Voucher discount" value={`−${amount(quote.summary.discount)}`} saving /> : null}
              {Number(quote.summary.shippingDiscount) > 0 ? <SummaryRow label="Shipping discount" value={`−${amount(quote.summary.shippingDiscount)}`} saving /> : null}
              <div className="flex items-end justify-between gap-4 border-t border-[#E6E0E8] pt-4"><dt className="font-semibold text-[#2D2231]">Total COD</dt><dd className="text-xl font-semibold text-[#E6007A]">{amount(quote.summary.payable)}</dd></div>
            </dl>
            <p className="mt-3 text-xs leading-5 text-[#746978]">{quote.summary.orderCount} {quote.summary.orderCount === 1 ? "order" : "orders"} will be created, one per Shop.</p>
          </>
        ) : (
          <p className="mt-4 text-sm leading-6 text-[#746978]">Choose a delivery address to calculate current prices, vouchers, shipping, and totals.</p>
        )}

        {message ? <p role="alert" className="mt-4 border-l-2 border-[#FF3B30] pl-3 text-sm leading-5 text-[#B42318]">{message}</p> : null}
        {status === "quoting" ? <p role="status" className="mt-4 text-sm text-[#665A6A]">Refreshing prices and availability…</p> : null}

        <button type="button" disabled={!quote || status === "quoting" || status === "placing"} onClick={() => void placeOrder()} className="mt-5 min-h-12 w-full rounded-md bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#C8006B] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] disabled:cursor-not-allowed disabled:bg-[#CFC6D2]">
          {status === "placing" ? "Placing order…" : "Place order"}
        </button>
        <p className="mt-3 flex gap-2 text-xs leading-5 text-[#746978]"><FiShield aria-hidden="true" className="mt-0.5 size-4 shrink-0" />Stock and vouchers are reserved only after the complete order is accepted.</p>
      </aside>
    </div>
  );
}

function ShopCheckoutGroup({ group, disabled, onToggleVoucher, selectedVouchers }: { group: CheckoutQuote["groups"][number]; disabled: boolean; onToggleVoucher: (voucher: CheckoutVoucher, shopId: string) => Promise<void>; selectedVouchers: VoucherSelection[] }) {
  return (
    <section className="border border-[#DED7E1] bg-white" aria-labelledby={`shop-${group.shop.id}`}>
      <div className="border-b border-[#E6E0E8] px-4 py-3.5 sm:px-5"><h2 id={`shop-${group.shop.id}`} className="text-base font-semibold text-[#2D2231]">{group.shop.name}</h2></div>
      <div className="divide-y divide-[#EEE9EF]">
        {group.items.map((item) => (
          <div key={`${item.productId}:${item.variantId ?? "base"}`} className="flex items-start justify-between gap-4 px-4 py-4 text-sm sm:px-5">
            <div className="min-w-0"><p className="font-medium text-[#302534]">{item.productName}</p>{item.selectedOptions.length ? <p className="mt-1 text-xs text-[#746978]">{item.selectedOptions.map((option) => `${option.group}: ${option.value}`).join(" · ")}</p> : null}<p className="mt-1 text-xs text-[#887D8B]">Qty {item.quantity} · SKU {item.sku}</p></div>
            <strong className="shrink-0 text-[#3A2E3E]">{amount(item.lineSubtotal)}</strong>
          </div>
        ))}
      </div>
      {group.availableVouchers.length ? (
        <details className="border-t border-[#E6E0E8] px-4 py-4 sm:px-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#4C1268] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]">Shop and Aisley vouchers <FiChevronDown aria-hidden="true" /></summary>
          <div className="mt-3 space-y-2">
            {group.availableVouchers.map((voucher) => {
              const selected = selectedVouchers.some((item) => item.voucher_id === voucher.id && item.target_shop_id === group.shop.id);
              return (
                <button key={voucher.id} type="button" disabled={disabled || !voucher.eligible} onClick={() => void onToggleVoucher(voucher, group.shop.id)} aria-pressed={selected} className={`w-full border p-3 text-left disabled:cursor-not-allowed ${selected ? "border-[#E6007A] bg-[#FFF7FB]" : "border-[#DDD5E0] bg-white"} disabled:bg-[#F5F2F5] disabled:text-[#8B808F]`}>
                  <span className="flex items-start justify-between gap-3"><span><span className="block text-sm font-semibold">{voucher.code} · {voucher.issuerType === "app" ? "Aisley" : "Shop"} {voucher.benefitType}</span><span className="mt-1 block text-xs leading-5">{voucher.termsSummary || `${voucher.valueType === "percent" ? `${voucher.value}%` : amount(voucher.value)} savings`}</span></span><span className="shrink-0 text-xs font-semibold">{voucher.eligible ? `Save ${amount(voucher.saving)}` : "Unavailable"}</span></span>
                  {!voucher.eligible && voucher.reason ? <span className="mt-2 block text-xs text-[#765226]">{voucherReasons[voucher.reason] ?? "This voucher is not eligible for this Shop order."}</span> : null}
                  {voucher.issuerType === "app" ? <span className="mt-2 block text-xs text-[#746978]">Applies only to {group.shop.name} when selected here.</span> : null}
                </button>
              );
            })}
          </div>
        </details>
      ) : null}
      <dl className="space-y-2 border-t border-[#E6E0E8] bg-[#FCFAFC] px-4 py-4 text-sm sm:px-5"><SummaryRow label="Merchandise" value={amount(group.totals.merchandiseSubtotal)} /><SummaryRow label="Shipping" value={amount(group.totals.shippingFee)} />{Number(group.totals.discount) > 0 ? <SummaryRow label="Voucher discount" value={`−${amount(group.totals.discount)}`} saving /> : null}{Number(group.totals.shippingDiscount) > 0 ? <SummaryRow label="Shipping discount" value={`−${amount(group.totals.shippingDiscount)}`} saving /> : null}<div className="flex justify-between gap-4 border-t border-[#E6E0E8] pt-2 font-semibold"><dt>Shop total</dt><dd className="text-[#E6007A]">{amount(group.totals.payable)}</dd></div></dl>
    </section>
  );
}

function SummaryRow({ label, saving = false, value }: { label: string; saving?: boolean; value: string }) { return <div className="flex items-center justify-between gap-4"><dt className="text-[#665A6A]">{label}</dt><dd className={saving ? "font-medium text-[#3F6846]" : "text-[#3A2E3E]"}>{value}</dd></div>; }

function CheckoutLoading() { return <div aria-label="Loading checkout" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="space-y-5">{[180, 130, 260].map((height) => <div key={height} style={{ height }} className="animate-pulse border border-[#DED7E1] bg-white" />)}</div><div className="h-72 animate-pulse border border-[#DED7E1] bg-white" /></div>; }

function MissingIntent({ message }: { message: string | null }) { return <div className="border border-[#DED7E1] bg-white px-5 py-12 text-center"><FiMapPin aria-hidden="true" className="mx-auto size-9 text-[#8B7D90]" /><h2 className="mt-4 text-lg font-semibold text-[#2D2231]">Checkout could not be started</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#665A6A]">{message}</p><div className="mt-5 flex justify-center gap-3"><Link href="/cart" className="rounded-md bg-[#E6007A] px-4 py-2.5 text-sm font-semibold text-white">Return to cart</Link><Link href="/" className="rounded-md border border-[#CFC6D2] bg-white px-4 py-2.5 text-sm font-semibold text-[#4C1268]">Browse products</Link></div></div>; }
