"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { FiSearch } from "react-icons/fi";

import { trackMarketplaceEvent } from "@/lib/marketplace/analytics";
import { searchHref, type SearchMode } from "@/lib/marketplace/discovery-url";

export function MarketplaceSearch({
  id = "marketplace-search",
  initialQuery = "",
  mode = "products",
}: {
  id?: string;
  initialQuery?: string;
  mode?: SearchMode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const input = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return;
    }

    if (Array.from(normalizedQuery).length > 100 || !navigator.onLine) {
      input.current?.setCustomValidity(navigator.onLine ? "Use up to 100 characters." : "You are offline. Reconnect before searching.");
      input.current?.reportValidity();
      return;
    }

    trackMarketplaceEvent("homepage_search_submit", {
      query: normalizedQuery,
    });
    startTransition(() => router.push(searchHref(normalizedQuery, mode)));
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="flex h-11 min-w-0 flex-1 overflow-hidden rounded-lg border-2 border-[#E6007A] bg-white focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[#E6007A]/20"
    >
      <label htmlFor={id} className="sr-only">
        {mode === "shops" ? "Search shops on Aisley" : "Search the Aisley marketplace"}
      </label>
      <input
        id={id}
        ref={input}
        name="q"
        type="search"
        value={query}
        onChange={(event) => { event.target.setCustomValidity(""); setQuery(event.target.value); }}
        placeholder={mode === "shops" ? "Search Shop names" : "Search products, categories, and shops"}
        autoComplete="off"
        className="min-w-0 flex-1 bg-white px-3.5 text-sm text-[#231429] outline-none placeholder:text-[#827687] sm:px-4 sm:text-[15px]"
      />
      <button
        type="submit"
        aria-label="Search"
        disabled={!query.trim() || isPending}
        aria-busy={isPending}
        className="flex w-12 shrink-0 items-center justify-center bg-[#E6007A] text-white transition-colors hover:bg-[#C9006B] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-white disabled:cursor-not-allowed disabled:bg-[#C8BFCB] sm:w-14"
      >
        <FiSearch aria-hidden="true" className="size-5" /><span className="sr-only">{isPending ? "Searching…" : "Submit search"}</span>
      </button>
    </form>
  );
}
