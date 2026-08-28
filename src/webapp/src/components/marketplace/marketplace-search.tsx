"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FiSearch } from "react-icons/fi";

import { trackMarketplaceEvent } from "@/lib/marketplace/analytics";

export function MarketplaceSearch({
  id = "marketplace-search",
  initialQuery = "",
}: {
  id?: string;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    trackMarketplaceEvent("homepage_search_submit", {
      query: normalizedQuery,
    });
    router.push(`/search?q=${encodeURIComponent(normalizedQuery)}`);
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex h-11 min-w-0 flex-1 overflow-hidden rounded-lg border-2 border-[#E6007A] bg-white focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[#E6007A]/20"
    >
      <label htmlFor={id} className="sr-only">
        Search the Aisley marketplace
      </label>
      <input
        id={id}
        name="q"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search products, brands, and shops"
        autoComplete="off"
        maxLength={100}
        className="min-w-0 flex-1 bg-white px-3.5 text-sm text-[#231429] outline-none placeholder:text-[#827687] sm:px-4 sm:text-[15px]"
      />
      <button
        type="submit"
        aria-label="Search"
        disabled={!query.trim()}
        className="flex w-12 shrink-0 items-center justify-center bg-[#E6007A] text-white transition-colors hover:bg-[#C9006B] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white disabled:cursor-not-allowed disabled:bg-[#C8BFCB] sm:w-14"
      >
        <FiSearch aria-hidden="true" className="size-5" />
      </button>
    </form>
  );
}
