"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiLogOut, FiSettings, FiUser } from "react-icons/fi";

import { useAuth } from "@/components/auth/auth-provider";

function initials(name: string | null) {
  return (name ?? "A")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();
}

export function AccountMenu() {
  const { auth, logout } = useAuth();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (auth.status === "loading") {
    return <div aria-label="Checking account session" className="h-10 w-16 animate-pulse rounded-md bg-[#F0EBF1]" />;
  }

  if (auth.status === "guest") {
    return (
      <Link
        href="/login"
        aria-label="Sign in"
        className="flex min-w-11 max-w-20 flex-col items-center justify-center rounded-md px-1.5 py-1 text-[11px] font-medium text-[#4C1268] transition-colors hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
      >
        <FiUser aria-hidden="true" className="size-5" />
        <span className="mt-0.5 hidden lg:block">Sign in</span>
      </Link>
    );
  }

  const { customer } = auth;
  const name = customer.displayName ?? "My account";

  async function handleLogout() {
    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      await logout();
      setIsOpen(false);
      router.replace("/");
      router.refresh();
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "We could not sign you out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`Account menu for ${name}`}
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-w-11 max-w-28 flex-col items-center justify-center rounded-md px-1.5 py-1 text-[11px] font-medium text-[#4C1268] transition-colors hover:bg-[#F6F0F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
      >
        <span className="flex items-center gap-1">
          <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-[#4C1268] text-[9px] font-bold text-white">
            {initials(name)}
          </span>
          <FiChevronDown aria-hidden="true" className="hidden size-3 lg:block" />
        </span>
        <span className="mt-0.5 hidden max-w-24 truncate lg:block">{name}</span>
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label="Customer account"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 border border-[#DED7E1] bg-white py-1 shadow-[0_2px_8px_rgba(49,18,63,0.12)]"
        >
          <Link role="menuitem" href="/account/profile" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-[#3E3242] hover:bg-[#F7F1F8] focus:bg-[#F7F1F8] focus:outline-none">
            <FiUser aria-hidden="true" className="size-4" /> Profile
          </Link>
          <Link role="menuitem" href="/account/wishlist" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-[#3E3242] hover:bg-[#F7F1F8] focus:bg-[#F7F1F8] focus:outline-none">
            <FiUser aria-hidden="true" className="size-4" /> Wishlist
          </Link>
          <Link role="menuitem" href="/account/settings" onClick={() => setIsOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-[#3E3242] hover:bg-[#F7F1F8] focus:bg-[#F7F1F8] focus:outline-none">
            <FiSettings aria-hidden="true" className="size-4" /> Settings
          </Link>
          <div role="separator" className="my-1 border-t border-[#E9E4EB]" />
          <button type="button" role="menuitem" onClick={handleLogout} disabled={isLoggingOut} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[#9D174D] hover:bg-[#FFF1F5] focus:bg-[#FFF1F5] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60">
            <FiLogOut aria-hidden="true" className="size-4" /> {isLoggingOut ? "Signing out…" : "Logout"}
          </button>
          {logoutError ? <p role="alert" className="px-3 pb-2 pt-1 text-xs text-[#B42318]">{logoutError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
