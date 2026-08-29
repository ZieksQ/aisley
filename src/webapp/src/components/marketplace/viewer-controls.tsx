"use client";

import Link from "next/link";
import {
  FiMapPin,
  FiMessageCircle,
  FiShoppingCart,
} from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";
import { useCart } from "@/components/cart/cart-provider";
import { AccountMenu } from "./account-menu";
import { useHomeData } from "./home-data-provider";

function authDestination(path: string, isAuthenticated: boolean) {
  return isAuthenticated ? path : `/login?next=${encodeURIComponent(path)}`;
}

export function UtilityAccountControls() {
  const { auth } = useAuth();

  if (auth.status === "loading") {
    return <span aria-label="Checking account session" className="h-4 w-24 animate-pulse bg-[#F0EBF1]" />;
  }

  return auth.status === "authenticated" ? (
    <>
      <Link href="/account/profile" className="hover:text-[#E6007A]">
        {auth.customer.displayName ?? "My Account"}
      </Link>
      <Link href="/account/orders" className="hover:text-[#E6007A]">
        Track Order
      </Link>
    </>
  ) : (
    <>
      <Link href="/login" className="font-semibold hover:text-[#E6007A]">
        Log In
      </Link>
      <Link href="/register" className="font-semibold hover:text-[#E6007A]">
        Sign Up
      </Link>
    </>
  );
}

export function DeliveryLocation() {
  const { data } = useHomeData();
  const { viewer } = data;
  const location = viewer.deliveryLocation;

  return (
    <Link
      href={authDestination("/account/addresses", viewer.isAuthenticated)}
      className="hidden max-w-36 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[#4C1268] transition-colors hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] lg:flex"
    >
      <FiMapPin aria-hidden="true" className="size-5 shrink-0" />
      <span className="min-w-0 leading-tight">
        <span className="block text-[11px] text-[#746778]">Deliver to</span>
        <span className="block truncate text-xs font-semibold">
          {location
            ? `${location.cityMunicipality}, ${location.province}`
            : viewer.isAuthenticated
              ? "Add address"
              : "Set location"}
        </span>
      </span>
    </Link>
  );
}

export function HeaderAccountControls() {
  const { auth } = useAuth();
  const { cart } = useCart();
  const { data } = useHomeData();
  const { viewer } = data;
  const cartItemCount = cart?.itemCount ?? 0;
  const cartHref =
    auth.status === "guest"
      ? `/login?next=${encodeURIComponent("/cart")}`
      : "/cart";

  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
      <Link
        href={authDestination("/messages", viewer.isAuthenticated)}
        aria-label="Messages"
        className="flex min-w-11 flex-col items-center justify-center rounded-md px-1.5 py-1 text-[11px] font-medium text-[#4C1268] transition-colors hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
      >
        <FiMessageCircle aria-hidden="true" className="size-5" />
        <span className="mt-0.5 hidden lg:block">Messages</span>
      </Link>

      <Link
        href={cartHref}
        aria-label={`Cart with ${cartItemCount} items`}
        className="relative flex min-w-11 flex-col items-center justify-center rounded-md px-1.5 py-1 text-[11px] font-medium text-[#4C1268] transition-colors hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
      >
        <FiShoppingCart aria-hidden="true" className="size-5" />
        {cartItemCount > 0 ? (
          <span className="absolute right-0.5 top-0 flex min-w-4 items-center justify-center rounded-md bg-[#E6007A] px-1 text-[10px] font-bold leading-4 text-white">
            {cartItemCount > 99 ? "99+" : cartItemCount}
          </span>
        ) : null}
        <span className="mt-0.5 hidden lg:block">Cart</span>
      </Link>

      <AccountMenu />
    </div>
  );
}
