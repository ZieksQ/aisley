"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiRefreshCw,
  FiMapPin,
} from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";
import { useCart } from "@/components/cart/cart-provider";
import { ApiError } from "@/lib/api";
import {
  fetchAddresses,
  fetchCheckoutLogisticsOptions,
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
  CheckoutLogisticsOptions,
  CheckoutQuote,
  CheckoutRequestPayload,
  CheckoutVoucher,
  CustomerAddress,
  LogisticsSelection,
  VoucherSelection,
} from "@/lib/checkout/types";
import { CheckoutDeliverySection, CheckoutPaymentSection } from "./checkout-delivery-sections";
import { CheckoutSummary } from "./checkout-summary";
import { ShopCheckoutGroup } from "./shop-checkout-group";
import { ShippingProviderSelector } from "./shipping-provider-selector";

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

function payload(
  intent: CheckoutIntent,
  addressId: string,
  vouchers: VoucherSelection[],
  logisticsSelections: LogisticsSelection[] = [],
): CheckoutRequestPayload {
  return {
    ...checkoutPayloadForIntent(intent, addressId),
    vouchers,
    logistics_selections: logisticsSelections,
  };
}

function logisticsSelectionList(selected: Record<string, string>): LogisticsSelection[] {
  return Object.entries(selected).map(([shop_id, logistics_organization_id]) => ({
    shop_id,
    logistics_organization_id,
  }));
}

export function CheckoutPageContent() {
  const router = useRouter();
  const { auth } = useAuth();
  const { refresh: refreshCart } = useCart();
  const quoteSequence = useRef(0);
  const idempotencyKey = useRef<string | null>(null);
  const [intent, setIntent] = useState<CheckoutIntent | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedVouchers, setSelectedVouchers] = useState<VoucherSelection[]>([]);
  const [logisticsOptions, setLogisticsOptions] = useState<CheckoutLogisticsOptions | null>(null);
  const [selectedLogistics, setSelectedLogistics] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "quoting" | "placing" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  const loadQuote = useCallback(async (
    nextIntent: CheckoutIntent,
    addressId: string,
    vouchers: VoucherSelection[],
    logistics: Record<string, string>,
  ) => {
    const sequence = ++quoteSequence.current;
    setStatus("quoting");
    setMessage(null);
    try {
      const nextQuote = await quoteCheckout(
        payload(nextIntent, addressId, vouchers, logisticsSelectionList(logistics)),
      );
      if (sequence !== quoteSequence.current) return null;
      setQuote(nextQuote);
      setSelectedVouchers(vouchers);
      setSelectedLogistics(logistics);
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
  }, []);

  const loadShippingOptions = useCallback(async (
    nextIntent: CheckoutIntent,
    addressId: string,
    vouchers: VoucherSelection[],
    preferredSelections: Record<string, string> = {},
  ) => {
    const sequence = ++quoteSequence.current;
    setStatus("quoting");
    setMessage(null);
    setQuote(null);
    try {
      const result = await fetchCheckoutLogisticsOptions(
        payload(nextIntent, addressId, vouchers),
      );
      if (sequence !== quoteSequence.current) return null;

      const selections: Record<string, string> = {};
      for (const group of result.groups) {
        const preferred = preferredSelections[group.shop.id];
        const stillAvailable = group.options.some(
          (option) => option.organizationId === preferred,
        );
        if (stillAvailable) {
          selections[group.shop.id] = preferred;
        } else if (group.options.length === 1) {
          selections[group.shop.id] = group.options[0].organizationId;
        }
      }

      setLogisticsOptions(result);
      setSelectedLogistics(selections);
      const allSelected = result.groups.length > 0 && result.groups.every(
        (group) => group.options.length > 0 && selections[group.shop.id],
      );
      if (allSelected) {
        return await loadQuote(nextIntent, addressId, vouchers, selections);
      }

      setStatus("ready");
      return null;
    } catch (caught) {
      if (sequence !== quoteSequence.current) return null;
      const error = caught instanceof ApiError ? caught : null;
      setMessage(error?.message ?? "We could not load shipping options for your Shops.");
      setStatus("error");
      return null;
    }
  }, [loadQuote]);

  useEffect(() => {
    if (auth.status === "guest") {
      router.replace(`/login?next=${encodeURIComponent("/checkout")}`);
      return;
    }
    if (auth.status !== "authenticated") return;

    const nextIntent = readCheckoutIntent();
    if (!nextIntent) {
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        setStatus("error");
        setMessage("Your checkout selection is missing or expired. Return to your cart or a product page to start again.");
      });
      return () => {
        active = false;
      };
    }

    const controller = new AbortController();
    fetchAddresses(controller.signal)
      .then(async (items) => {
        setIntent(nextIntent);
        const shippingAddresses = items.filter((item) => item.type !== "billing");
        setAddresses(shippingAddresses);
        const selected =
          shippingAddresses.find((item) => item.isDefault) ?? shippingAddresses[0];
        if (!selected) {
          setStatus("ready");
          return;
        }
        setSelectedAddressId(selected.id);
        await loadShippingOptions(nextIntent, selected.id, []);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setStatus("error");
        setMessage(caught instanceof ApiError ? caught.message : "We could not load your saved addresses.");
      });

    return () => controller.abort();
  }, [auth.status, loadShippingOptions, router]);

  if (auth.status !== "authenticated" || status === "loading") {
    return <CheckoutLoading />;
  }

  if (!intent) {
    return <MissingIntent message={message} />;
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
          if (voucher.issuerType === "app" &&
            selectedVoucher?.issuerType === "app" &&
            selectedVoucher.benefitType === voucher.benefitType) {
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
    await loadQuote(intent, selectedAddressId, next, selectedLogistics);
  }

  async function selectLogisticsProvider(shopId: string, providerId: string) {
    if (!intent || !selectedAddressId) return;
    const next = { ...selectedLogistics, [shopId]: providerId };
    setSelectedLogistics(next);
    setQuote(null);
    const allSelected = logisticsOptions?.groups.every(
      (group) => group.options.length > 0 && next[group.shop.id],
    );
    if (allSelected) {
      await loadQuote(intent, selectedAddressId, selectedVouchers, next);
    }
  }

  async function placeOrder() {
    if (!intent || !selectedAddressId || !quote) return;
    setStatus("placing");
    setMessage(null);
    idempotencyKey.current ??= crypto.randomUUID();

    try {
      const batch = await placeCheckout(
        {
          ...payload(intent, selectedAddressId, selectedVouchers, logisticsSelectionList(selectedLogistics)),
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
        setMessage(`${error.message} Shipping options and fees were refreshed for review.`);
        await loadShippingOptions(intent, selectedAddressId, selectedVouchers, selectedLogistics);
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
        <CheckoutDeliverySection address={selectedAddress} />
        <CheckoutPaymentSection />

        {logisticsOptions?.groups.map((group) => {
          const quoteGroup = quote?.groups.find((item) => item.shop.id === group.shop.id);
          if (quoteGroup) {
            return (
              <ShopCheckoutGroup
                key={group.shop.id}
                group={quoteGroup}
                shippingOptions={group}
                selectedProviderId={selectedLogistics[group.shop.id]}
                onSelectProvider={(providerId) => void selectLogisticsProvider(group.shop.id, providerId)}
                disabled={status === "quoting" || status === "placing"}
                selectedVouchers={selectedVouchers}
                onToggleVoucher={toggleVoucher}
                formatAmount={amount}
                voucherReasons={voucherReasons}
              />
            );
          }

          return (
            <section
              key={`shipping-${group.shop.id}`}
              className="border border-[#DED7E1] bg-white"
              aria-labelledby={`shipping-shop-${group.shop.id}`}
            >
              <h2
                id={`shipping-shop-${group.shop.id}`}
                className="border-b border-[#E6E0E8] px-4 py-3.5 text-base font-semibold text-[#2D2231] sm:px-5"
              >
                Shipping · {group.shop.name}
              </h2>
              <ShippingProviderSelector
                disabled={status === "quoting" || status === "placing"}
                options={group}
                selectedProviderId={selectedLogistics[group.shop.id]}
                onSelect={(providerId) => void selectLogisticsProvider(group.shop.id, providerId)}
                formatAmount={amount}
              />
            </section>
          );
        })}

        {selectedAddress && status !== "quoting" && (logisticsOptions || status === "error") ? (
          <button type="button" onClick={() => void loadShippingOptions(intent, selectedAddress.id, selectedVouchers, selectedLogistics)} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] bg-white px-4 text-sm font-semibold text-[#4C1268]">
            <FiRefreshCw aria-hidden="true" /> Refresh shipping options
          </button>
        ) : null}
      </div>

      <CheckoutSummary
        quote={quote}
        message={message}
        status={status}
        onPlaceOrder={() => void placeOrder()}
        formatAmount={amount}
      />
    </div>
  );
}

function CheckoutLoading() { return <div aria-label="Loading checkout" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="space-y-5">{[180, 130, 260].map((height) => <div key={height} style={{ height }} className="animate-pulse border border-[#DED7E1] bg-white" />)}</div><div className="h-72 animate-pulse border border-[#DED7E1] bg-white" /></div>; }

function MissingIntent({ message }: { message: string | null }) { return <div className="border border-[#DED7E1] bg-white px-5 py-12 text-center"><FiMapPin aria-hidden="true" className="mx-auto size-9 text-[#8B7D90]" /><h2 className="mt-4 text-lg font-semibold text-[#2D2231]">Checkout could not be started</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#665A6A]">{message}</p><div className="mt-5 flex justify-center gap-3"><Link href="/cart" className="rounded-md bg-[#E6007A] px-4 py-2.5 text-sm font-semibold text-white">Return to cart</Link><Link href="/" className="rounded-md border border-[#CFC6D2] bg-white px-4 py-2.5 text-sm font-semibold text-[#4C1268]">Browse products</Link></div></div>; }
