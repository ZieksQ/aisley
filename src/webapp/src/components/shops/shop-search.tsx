"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@aisley/ui";
import { shopProductsHref } from "@/lib/marketplace/discovery-url";
import { focusAfterBrowseNavigation } from "./browse-controls";

const clearClass = "inline-flex min-h-11 items-center text-sm font-semibold text-[#4C1268] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]";

type ShopSearchProps = { slug: string; query: string; category: string | null };

export function ShopSearch({ slug, query, category }: ShopSearchProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(query);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = draft.trim();
    if (Array.from(normalized).length > 100 || !navigator.onLine) {
      setError(navigator.onLine ? "Use up to 100 characters." : "You are offline. Reconnect before searching this Shop.");
      input.current?.focus();
      return;
    }
    setError("");
    focusAfterBrowseNavigation();
    startTransition(() => router.push(shopProductsHref(slug, normalized, category)));
  }

  return (
    <div className="mb-5 space-y-2">
      <form onSubmit={submit} role="search" aria-label="Search in this Shop" className="flex flex-wrap items-end gap-3">
        <label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold text-[#3E3242]" htmlFor="shop-product-search">
          Search in this Shop
          <input
            ref={input}
            id="shop-product-search"
            name="q"
            type="search"
            value={draft}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "shop-search-error" : undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              setError("");
            }}
            className="min-h-11 w-full rounded-md border border-[#CFC4D2] bg-white px-3 text-sm font-normal text-[#342638] outline-none focus:border-[#E6007A] focus:ring-2 focus:ring-[#E6007A]/20"
          />
        </label>
        <Button
          type="submit"
          disabled={pending}
          variant="secondary"
          className="min-h-11! rounded-lg! bg-[#4C1268] px-4 py-2 text-sm text-white shadow-none! focus-visible:outline-solid! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-[#E6007A]!"
        >
          {pending ? "Searching…" : "Search Shop"}
        </Button>
      </form>
      {error && <p id="shop-search-error" className="text-sm text-red-700" role="alert">{error}</p>}
      <span className="sr-only" role="status">{pending ? "Updating Shop products" : ""}</span>
      <ShopFilterClearLinks slug={slug} query={query} category={category} />
    </div>
  );
}

function ShopFilterClearLinks({ slug, query, category }: ShopSearchProps) {
  return (
    <div className="flex flex-wrap gap-4">
      {query && (
        <Link className={clearClass} onClick={focusAfterBrowseNavigation} href={shopProductsHref(slug, "", category)}>
          Clear keyword
        </Link>
      )}
      {category && (
        <Link className={clearClass} onClick={focusAfterBrowseNavigation} href={shopProductsHref(slug, query, null)}>
          Clear category
        </Link>
      )}
      {query && category && (
        <Link className={clearClass} onClick={focusAfterBrowseNavigation} href={shopProductsHref(slug, "", null)}>
          Clear all filters
        </Link>
      )}
    </div>
  );
}
