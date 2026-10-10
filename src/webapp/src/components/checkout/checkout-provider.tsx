"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { useCart } from "@/components/cart/cart-provider";
import { ApiError } from "@/lib/api";
import { checkoutPlacement } from "@/lib/checkout/placement";
import {
  fetchAddresses,
  fetchCheckoutLogisticsOptions,
  placeCheckout,
  quoteCheckout,
} from "@/lib/checkout/client";
import {
  checkoutPayload as payload,
  logisticsSelectionList,
  clearCheckoutIntent,
  readCheckoutIntent,
} from "@/lib/checkout/intent";
import type {
  CheckoutIntent,
  CheckoutLogisticsOptions,
  CheckoutQuote,
  CustomerAddress,
  VoucherSelection,
} from "@/lib/checkout/types";
const CheckoutContext = createContext<ReturnType<
  typeof useCheckoutSession
> | null>(null);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const key = auth.status === "authenticated" ? auth.customer.id : auth.status;
  return (
    <CheckoutCustomerSession key={key}>{children}</CheckoutCustomerSession>
  );
}

function CheckoutCustomerSession({ children }: { children: ReactNode }) {
  const session = useCheckoutSession();
  return (
    <CheckoutContext.Provider value={session}>
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout() {
  const context = useContext(CheckoutContext);
  if (!context) throw new Error("CheckoutProvider is required.");
  return context;
}

function useCheckoutSession() {
  const router = useRouter();
  const pathname = usePathname();
  const { auth } = useAuth();
  const { refresh: refreshCart } = useCart();
  const quoteSequence = useRef(0);
  const placementBusy = useRef(false);
  const activeCustomer = useRef<string | null>(null);
  const customerId = auth.status === "authenticated" ? auth.customer.id : null;
  const [intent, setIntent] = useState<CheckoutIntent | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [selectedVouchers, setSelectedVouchers] = useState<VoucherSelection[]>(
    [],
  );
  const [logisticsOptions, setLogisticsOptions] =
    useState<CheckoutLogisticsOptions | null>(null);
  const [selectedLogistics, setSelectedLogistics] = useState<
    Record<string, string>
  >({});
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "quoting" | "placing" | "uncertain" | "error"
  >("loading");
  const [message, setMessage] = useState<string | null>(null);

  const loadQuote = useCallback(
    async (
      nextIntent: CheckoutIntent,
      addressId: string,
      vouchers: VoucherSelection[],
      logistics: Record<string, string>,
    ) => {
      if (!customerId || checkoutPlacement.read(customerId)) return null;
      const sequence = ++quoteSequence.current;
      setStatus("quoting");
      setMessage(null);
      try {
        const nextQuote = await quoteCheckout(
          payload(
            nextIntent,
            addressId,
            vouchers,
            logisticsSelectionList(logistics),
          ),
        );
        if (sequence !== quoteSequence.current) return null;
        setQuote(nextQuote);
        setSelectedVouchers(vouchers);
        setSelectedLogistics(logistics);
        setStatus("ready");
        return nextQuote;
      } catch (caught) {
        if (sequence !== quoteSequence.current) return null;
        const error = caught instanceof ApiError ? caught : null;
        setMessage(
          error?.status === 409
            ? `Your checkout changed: ${error.message}`
            : (error?.message ?? "We could not prepare this checkout."),
        );
        setStatus("error");
        return null;
      }
    },
    [customerId],
  );

  const loadShippingOptions = useCallback(
    async (
      nextIntent: CheckoutIntent,
      addressId: string,
      vouchers: VoucherSelection[],
      preferredSelections: Record<string, string> = {},
    ) => {
      if (!customerId || checkoutPlacement.read(customerId)) return null;
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

        setAddresses((items) => (items.length ? items : [result.address]));
        setLogisticsOptions(result);
        setSelectedLogistics(selections);
        const allSelected =
          result.groups.length > 0 &&
          result.groups.every(
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
        setMessage(
          error?.message ??
            "We could not load shipping options for your Shops.",
        );
        setStatus("error");
        return null;
      }
    },
    [customerId, loadQuote],
  );

  useEffect(() => {
    activeCustomer.current = customerId;
    return () => {
      activeCustomer.current = null;
      quoteSequence.current += 1;
    };
  }, [customerId]);

  useEffect(() => {
    if (auth.status === "guest")
      router.replace(
        `/login?next=${encodeURIComponent(pathname + window.location.search)}`,
      );
  }, [auth.status, pathname, router]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;

    let pending;
    try {
      pending = checkoutPlacement.read(auth.customer.id);
    } catch {
      queueMicrotask(() => {
        setStatus("error");
        setMessage(
          "Checkout recovery is unavailable. Enable browser session storage and reload before placing an order.",
        );
      });
      return;
    }
    if (pending) {
      queueMicrotask(() => {
        setIntent(pending.intent);
        setSelectedAddressId(pending.payload.address_id);
        setSelectedVouchers(pending.payload.vouchers);
        setSelectedLogistics(
          Object.fromEntries(
            (pending.payload.logistics_selections ?? []).map((item) => [
              item.shop_id,
              item.logistics_organization_id,
            ]),
          ),
        );
        setStatus("uncertain");
        setMessage(
          "Your previous order is awaiting confirmation. Retry the original order before changing checkout.",
        );
      });
      return;
    }
    const nextIntent = readCheckoutIntent();
    if (!nextIntent) {
      let active = true;
      queueMicrotask(() => {
        if (!active) return;
        setStatus("error");
        setMessage(
          "Your checkout selection is missing or expired. Return to your cart or a product page to start again.",
        );
      });
      return () => {
        active = false;
      };
    }

    const controller = new AbortController();
    fetchAddresses(controller.signal)
      .then(async (items) => {
        if (controller.signal.aborted) return;
        setIntent(nextIntent);
        const shippingAddresses = items.filter(
          (item) => item.type !== "billing",
        );
        setAddresses(shippingAddresses);
        const selected =
          shippingAddresses.find((item) => item.isDefault) ??
          shippingAddresses[0];
        if (!selected) {
          setStatus("ready");
          return;
        }
        setSelectedAddressId(selected.id);
        await loadShippingOptions(nextIntent, selected.id, []);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError")
          return;
        setStatus("error");
        setMessage(
          caught instanceof ApiError
            ? caught.message
            : "We could not load your saved addresses.",
        );
      });

    return () => {
      controller.abort();
      quoteSequence.current += 1;
    };
  }, [auth, loadShippingOptions, router]);

  async function applyVouchers(vouchers: VoucherSelection[]) {
    if (
      !intent ||
      !selectedAddressId ||
      !customerId ||
      (status !== "ready" && status !== "error") ||
      checkoutPlacement.read(customerId)
    )
      return false;
    return Boolean(
      await loadQuote(intent, selectedAddressId, vouchers, selectedLogistics),
    );
  }

  async function selectLogisticsProvider(shopId: string, providerId: string) {
    if (
      !intent ||
      !selectedAddressId ||
      !customerId ||
      checkoutPlacement.read(customerId)
    )
      return;
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
    if (!customerId || placementBusy.current || !intent || !selectedAddressId)
      return;
    if (status !== "ready" && status !== "uncertain") return;
    if (!quote && !checkoutPlacement.read(customerId)) return;
    placementBusy.current = true;
    ++quoteSequence.current;
    setStatus("placing");
    setMessage(null);
    try {
      const batch = await checkoutPlacement.submit(
        customerId,
        quote
          ? {
              intent,
              payload: {
                ...payload(
                  intent,
                  selectedAddressId,
                  selectedVouchers,
                  logisticsSelectionList(selectedLogistics),
                ),
                quote_id: quote.quoteId,
              },
            }
          : null,
        placeCheckout,
      );
      if (activeCustomer.current !== customerId) return;
      clearCheckoutIntent();
      checkoutPlacement.clear();
      router.replace(`/checkout/result/${batch.id}`);
      void refreshCart().catch(() => {});
    } catch (caught) {
      if (activeCustomer.current !== customerId) return;
      const error =
        caught instanceof Error
          ? caught.message
          : "Order confirmation is unavailable.";
      if (!checkoutPlacement.read(customerId)) {
        await loadShippingOptions(
          intent,
          selectedAddressId,
          selectedVouchers,
          selectedLogistics,
        );
        setMessage(
          `${error} Review the refreshed shipping and totals before placing your order.`,
        );
      } else {
        setMessage(
          `${error} Retry the original order to confirm its outcome. Shipping and vouchers remain locked.`,
        );
        setStatus("uncertain");
      }
    } finally {
      placementBusy.current = false;
    }
  }

  return {
    customerId,
    intent,
    addresses,
    selectedAddressId,
    selectedVouchers,
    logisticsOptions,
    selectedLogistics,
    quote,
    status,
    message,
    loadShippingOptions,
    selectLogisticsProvider,
    placeOrder,
    applyVouchers,
  };
}
