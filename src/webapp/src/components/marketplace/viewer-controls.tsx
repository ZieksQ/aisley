"use client";

import Link from "next/link";
import {
  FiHeart,
  FiMapPin,
  FiMessageCircle,
  FiShoppingCart,
  FiUser,
} from "react-icons/fi";

import { useHomeData } from "./home-data-provider";

function authDestination(path: string, isAuthenticated: boolean) {
  return isAuthenticated ? path : `/login?returnTo=${encodeURIComponent(path)}`;
}

export function UtilityAccountControls() {
  const { data } = useHomeData();
  const { viewer } = data;

  return viewer.isAuthenticated ? (
    <>
      <Link href="/account" className="hover:text-[#E6007A]">
        {viewer.displayName ? `Hi, ${viewer.displayName}` : "My Account"}
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
          {location?.cityMunicipality ?? "Set location"}
        </span>
      </span>
    </Link>
  );
}

export function HeaderAccountControls() {
  const { data } = useHomeData();
  const { viewer } = data;

  const controls = [
    {
      label: "Messages",
      href: authDestination("/messages", viewer.isAuthenticated),
      icon: FiMessageCircle,
      desktopOnly: true,
    },
    {
      label: "Wishlist",
      href: authDestination("/wishlist", viewer.isAuthenticated),
      icon: FiHeart,
      desktopOnly: true,
    },
    {
      label: viewer.isAuthenticated
        ? viewer.displayName ?? "Account"
        : "Sign in",
      href: viewer.isAuthenticated ? "/account" : "/login",
      icon: FiUser,
      desktopOnly: true,
    },
  ];

  return (
    <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
      {controls.map((control) => {
        const Icon = control.icon;

        return (
          <Link
            key={control.label}
            href={control.href}
            aria-label={control.label}
            className={`${
              control.desktopOnly ? "hidden sm:flex" : "flex"
            } min-w-11 flex-col items-center justify-center rounded-md px-1.5 py-1 text-[11px] font-medium text-[#4C1268] transition-colors hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]`}
          >
            <Icon aria-hidden="true" className="size-5" />
            <span className="mt-0.5 hidden max-w-16 truncate lg:block">
              {control.label}
            </span>
          </Link>
        );
      })}

      <Link
        href={authDestination("/cart", viewer.isAuthenticated)}
        aria-label={`Cart with ${viewer.cartItemCount} items`}
        className="relative flex min-w-11 flex-col items-center justify-center rounded-md px-1.5 py-1 text-[11px] font-medium text-[#4C1268] transition-colors hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
      >
        <FiShoppingCart aria-hidden="true" className="size-5" />
        {viewer.cartItemCount > 0 ? (
          <span className="absolute right-0.5 top-0 flex min-w-4 items-center justify-center rounded-md bg-[#E6007A] px-1 text-[10px] font-bold leading-4 text-white">
            {viewer.cartItemCount > 99 ? "99+" : viewer.cartItemCount}
          </span>
        ) : null}
        <span className="mt-0.5 hidden lg:block">Cart</span>
      </Link>
    </div>
  );
}
