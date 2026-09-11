import Link from "next/link";
import type { ReactNode } from "react";

import {
  MarketplaceHeader,
  UtilityBar,
} from "@/components/marketplace/marketplace-header";

export function PolicyPageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-5 lg:px-8 lg:py-12">
        {children}
      </main>
    </>
  );
}

export function PolicyFooter() {
  return (
    <footer className="border-t border-[#E9E4EB] bg-white px-4 py-6 text-sm text-[#746978] sm:px-5 lg:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
        <p>© {new Date().getFullYear()} Aisley. Shop with confidence.</p>
        <nav aria-label="Policy links" className="flex gap-4">
          <Link className="hover:text-[#4C1268] focus-visible:outline-2 focus-visible:outline-[#E6007A]" href="/policies/terms_of_service">Terms of Service</Link>
          <Link className="hover:text-[#4C1268] focus-visible:outline-2 focus-visible:outline-[#E6007A]" href="/policies/privacy_policy">Privacy Policy</Link>
        </nav>
      </div>
    </footer>
  );
}

export function PolicyError({ href }: { href: string }) {
  return (
    <section className="border border-[#E2DCE4] bg-white px-6 py-12 text-center" role="alert">
      <h1 className="text-xl font-semibold text-[#2D2231]">Policy temporarily unavailable</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6B5F6F]">We could not load this policy. Check your connection and try again.</p>
      <Link className="mt-5 inline-flex min-h-10 items-center rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3D0E54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]" href={href}>Try again</Link>
    </section>
  );
}

export function PolicyNotFound({ href }: { href: string }) {
  return (
    <section className="border border-[#E2DCE4] bg-white px-6 py-12 text-center" role="status">
      <h1 className="text-xl font-semibold text-[#2D2231]">Policy version not found</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#6B5F6F]">This version is not published or is no longer available.</p>
      <Link className="mt-5 inline-flex min-h-10 items-center rounded-md border border-[#CFC4D2] px-4 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-[#E6007A]" href={href}>View current policy</Link>
    </section>
  );
}

export function PolicyLoading() {
  return (
    <section aria-label="Loading policy" aria-live="polite" className="animate-pulse border border-[#DED7E1] bg-white px-5 py-8 sm:px-8 sm:py-10">
      <div className="h-4 w-36 rounded bg-[#EEE9EF]" />
      <div className="mt-4 h-9 max-w-xl rounded bg-[#EEE9EF]" />
      <div className="mt-3 h-4 max-w-xs rounded bg-[#F3EFF4]" />
      <div className="mt-8 space-y-3">
        <div className="h-4 rounded bg-[#F3EFF4]" />
        <div className="h-4 rounded bg-[#F3EFF4]" />
        <div className="h-4 w-4/5 rounded bg-[#F3EFF4]" />
      </div>
    </section>
  );
}
