import type { Metadata } from "next";
import Link from "next/link";

import {
  MarketplaceHeader,
  UtilityBar,
} from "@/components/marketplace/marketplace-header";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you are looking for could not be found.",
};

export default function NotFound() {
  return (
    <>
      <UtilityBar />
      <MarketplaceHeader />
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 items-center px-4 py-16 sm:px-5 sm:py-20 lg:px-8">
        <section className="mx-auto w-full max-w-xl text-center">
          <p
            aria-hidden="true"
            className="text-6xl font-bold tracking-[-0.04em] text-[#4C1268] sm:text-7xl"
          >
            404
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[#231429] sm:text-3xl">
            Page not found
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-[#4B5563]">
            We couldn’t find the page you’re looking for. It may have moved or
            the address may be incorrect.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-[#4C1268] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#3D0E54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268]"
          >
            Back to home
          </Link>
        </section>
      </main>
    </>
  );
}
