"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiRefreshCw, FiShoppingCart } from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";

import { CartItemRow } from "./cart-item-row";
import { useCart } from "./cart-provider";

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

export function CartPageContent() {
  const router = useRouter();
  const { auth } = useAuth();
  const { cart, refresh, status } = useCart();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (auth.status === "guest") {
      router.replace(`/login?next=${encodeURIComponent("/cart")}`);
    }
  }, [auth.status, router]);

  if (auth.status !== "authenticated" || status === "loading") {
    return <CartLoadingState />;
  }

  if (status === "error") {
    return (
      <div className="border border-[#DED7E1] bg-white px-5 py-10 text-center sm:px-8">
        <p className="text-sm text-[#594D5D]">
          We could not load your cart. Check your connection and try again.
        </p>
        <button
          type="button"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            try {
              await refresh();
            } catch {
              // The provider keeps the error state visible for another retry.
            } finally {
              setRetrying(false);
            }
          }}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-[#CFC6D2] px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60"
        >
          <FiRefreshCw aria-hidden="true" className="size-4" />
          {retrying ? "Trying again…" : "Try again"}
        </button>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="border border-[#DED7E1] bg-white px-5 py-12 text-center sm:px-8">
        <FiShoppingCart
          aria-hidden="true"
          className="mx-auto size-10 text-[#8B7D90]"
        />
        <h2 className="mt-4 text-lg font-semibold text-[#2D2231]">
          Your cart is empty
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B5F6F]">
          Browse products and choose a variation to add your first item.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-[#E6007A] px-4 text-sm font-semibold text-white hover:bg-[#C8006B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]"
        >
          Browse products
        </Link>
      </div>
    );
  }

  const unavailableCount = cart.items.filter(
    (item) => !item.availability.isAvailable,
  ).length;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section
        aria-label="Cart items"
        className="border border-[#DED7E1] bg-white"
      >
        <div className="flex items-center justify-between border-b border-[#E6E0E8] px-4 py-4 sm:px-5">
          <p className="text-sm font-medium text-[#514656]">
            {cart.distinctItemCount} {cart.distinctItemCount === 1 ? "item" : "items"}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4C1268] hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
          >
            <FiArrowLeft aria-hidden="true" className="size-4" />
            Continue shopping
          </Link>
        </div>

        {cart.items.map((item) => (
          <CartItemRow
            key={`${item.id}:${item.variant?.id ?? "base"}:${item.quantity}`}
            item={item}
          />
        ))}
      </section>

      <aside className="border border-[#DED7E1] bg-white p-5 lg:sticky lg:top-32">
        <h2 className="text-base font-semibold text-[#2D2231]">Order summary</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4 text-[#5F5363]">
            <dt>Cart quantity</dt>
            <dd>{cart.itemCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 text-[#5F5363]">
            <dt>Available items</dt>
            <dd>{cart.distinctItemCount - unavailableCount}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-[#E6E0E8] pt-4">
            <dt className="font-semibold text-[#2D2231]">Available subtotal</dt>
            <dd className="text-lg font-semibold text-[#E6007A]">
              {moneyFormatter.format(cart.availableSubtotal)}
            </dd>
          </div>
        </dl>

        {unavailableCount > 0 ? (
          <p className="mt-4 border-l-2 border-[#FF8800] pl-3 text-xs leading-5 text-[#765226]">
            Resolve or remove unavailable items before a future checkout.
          </p>
        ) : null}

        <button
          type="button"
          disabled
          className="mt-5 min-h-11 w-full rounded-md bg-[#CFC6D2] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed"
        >
          Checkout not available yet
        </button>
        <p className="mt-3 text-xs leading-5 text-[#746978]">
          Cart items do not reserve stock. Price and availability are refreshed by Aisley.
        </p>
      </aside>
    </div>
  );
}

function CartLoadingState() {
  return (
    <div aria-label="Loading cart" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="border border-[#DED7E1] bg-white p-5">
        <div className="h-5 w-24 animate-pulse bg-[#ECE7ED]" />
        {[0, 1].map((item) => (
          <div key={item} className="mt-5 flex gap-4 border-t border-[#EEE9EF] pt-5">
            <div className="size-24 animate-pulse bg-[#F0ECF1]" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-4 w-2/3 animate-pulse bg-[#ECE7ED]" />
              <div className="h-3 w-1/2 animate-pulse bg-[#F0ECF1]" />
              <div className="h-9 w-32 animate-pulse bg-[#F0ECF1]" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-56 animate-pulse border border-[#DED7E1] bg-white" />
    </div>
  );
}
