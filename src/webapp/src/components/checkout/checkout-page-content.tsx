"use client";

import { useState } from "react";
import type { CheckoutQuote } from "@/lib/checkout/types";
import { CheckoutConfirmation } from "./checkout-confirmation";
import { FiRefreshCw } from "react-icons/fi";
import { useCheckout } from "./checkout-provider";
import {
  CheckoutDeliverySection,
  CheckoutPaymentSection,
} from "./checkout-delivery-sections";
import { amount, CheckoutLoading, MissingIntent } from "./checkout-display";
import { CheckoutSummary } from "./checkout-summary";
import { ShopCheckoutGroup } from "./shop-checkout-group";
import { ShippingProviderSelector } from "./shipping-provider-selector";

export function CheckoutPageContent() {
  const {
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
    placeOrder,
  } = useCheckout();
  const [reviewedQuote, setReviewedQuote] = useState<CheckoutQuote | null>(null);
  if (!customerId || status === "loading") return <CheckoutLoading />;
  if (!intent) return <MissingIntent message={message} />;

  const selectedAddress = addresses.find(
    (item) => item.id === selectedAddressId,
  );

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <CheckoutDeliverySection address={selectedAddress} />
        <CheckoutPaymentSection />

        {logisticsOptions?.groups.map((group) => {
          const quoteGroup = quote?.groups.find(
            (item) => item.shop.id === group.shop.id,
          );
          if (quoteGroup) {
            return (
              <ShopCheckoutGroup
                key={group.shop.id}
                group={quoteGroup}
                shippingOptions={group}
                selectedProviderId={selectedLogistics[group.shop.id]}
                disabled={
                  status === "quoting" ||
                  status === "placing" ||
                  status === "uncertain"
                }
                formatAmount={amount}
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
                disabled={
                  status === "quoting" ||
                  status === "placing" ||
                  status === "uncertain"
                }
                options={group}
                selectedProviderId={selectedLogistics[group.shop.id]}
                formatAmount={amount}
              />
            </section>
          );
        })}

        {selectedAddress &&
        status !== "quoting" &&
        (logisticsOptions || status === "error") ? (
          <button
            type="button"
            disabled={status === "placing" || status === "uncertain"}
            onClick={() =>
              void loadShippingOptions(
                intent,
                selectedAddress.id,
                selectedVouchers,
                selectedLogistics,
              )
            }
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] bg-white px-4 text-sm font-semibold text-[#4C1268]"
          >
            <FiRefreshCw aria-hidden="true" /> Refresh shipping options
          </button>
        ) : null}
      </div>

      <CheckoutSummary
        quote={quote}
        message={message}
        status={status}
        onPlaceOrder={() => {
          if (status === "uncertain") void placeOrder();
          else if (status === "ready" && quote) setReviewedQuote(quote);
        }}
        formatAmount={amount}
      />
      {reviewedQuote && reviewedQuote === quote && status === "ready" ? (
        <CheckoutConfirmation
          quote={reviewedQuote}
          onCancel={() => setReviewedQuote(null)}
          onConfirm={() => {
            setReviewedQuote(null);
            void placeOrder();
          }}
        />
      ) : null}
    </div>
  );
}
