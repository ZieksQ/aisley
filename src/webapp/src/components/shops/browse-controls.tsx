"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FiChevronLeft, FiChevronRight, FiRefreshCw } from "react-icons/fi";

import type { Pagination, ShopCategorySummary } from "@/lib/marketplace/types";

const focusFlag = "aisley-shop-browse-focus";

function focusAfterNavigation() {
  sessionStorage.setItem(focusFlag, "true");
}

export function CategoryFilter({
  categories,
  label,
  parameter,
  selected,
  targetId,
}: {
  categories: ShopCategorySummary[];
  label: string;
  parameter: "category" | "shop_category";
  selected: string | null;
  targetId: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (sessionStorage.getItem(focusFlag) === "true") {
      sessionStorage.removeItem(focusFlag);
      document.getElementById(targetId)?.focus({ preventScroll: true });
    }
  }, [selected, targetId]);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor={`${parameter}-filter`} className="text-sm font-semibold text-[#3E3242]">
        {label}
      </label>
      <select
        id={`${parameter}-filter`}
        value={selected ?? ""}
        disabled={isPending}
        aria-busy={isPending}
        onChange={(event) => {
          const parameters = new URLSearchParams(searchParams.toString());
          const value = event.target.value;
          if (value) parameters.set(parameter, value);
          else parameters.delete(parameter);
          parameters.delete("page");
          focusAfterNavigation();
          const query = parameters.toString();
          startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
        }}
        className="min-h-10 w-full rounded-md border border-[#CFC4D2] bg-white px-3 text-sm text-[#342638] outline-none focus:border-[#E6007A] focus:ring-2 focus:ring-[#E6007A]/20 disabled:cursor-wait disabled:opacity-60 sm:w-64"
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.slug}>
            {category.name}
          </option>
        ))}
      </select>
      <span className="sr-only" aria-live="polite">
        {isPending ? "Updating results" : ""}
      </span>
    </div>
  );
}

export function BrowsePagination({
  pagination,
  label,
  targetId,
}: {
  pagination: Pagination;
  label: string;
  targetId: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pageHref(page: number) {
    const parameters = new URLSearchParams(searchParams.toString());
    if (page === 1) parameters.delete("page");
    else parameters.set("page", String(page));
    const query = parameters.toString();

    return query ? `${pathname}?${query}` : pathname;
  }

  useEffect(() => {
    if (sessionStorage.getItem(focusFlag) === "true") {
      sessionStorage.removeItem(focusFlag);
      document.getElementById(targetId)?.focus({ preventScroll: true });
    }
  }, [searchParams, targetId]);

  if (pagination.lastPage <= 1) return null;

  return (
    <nav aria-label={label} className="mt-8 flex items-center justify-center gap-3">
      {pagination.currentPage > 1 ? (
        <Link
          href={pageHref(pagination.currentPage - 1)}
          onClick={focusAfterNavigation}
          className="flex min-h-10 items-center gap-1 rounded-md border border-[#CFC4D2] bg-white px-3 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
        >
          <FiChevronLeft aria-hidden="true" />
          Previous
        </Link>
      ) : null}
      <span className="text-sm text-[#675B6B]">
        Page {pagination.currentPage} of {pagination.lastPage}
      </span>
      {pagination.currentPage < pagination.lastPage ? (
        <Link
          href={pageHref(pagination.currentPage + 1)}
          onClick={focusAfterNavigation}
          className="flex min-h-10 items-center gap-1 rounded-md border border-[#CFC4D2] bg-white px-3 text-sm font-semibold text-[#4C1268] hover:bg-[#F7F1F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
        >
          Next
          <FiChevronRight aria-hidden="true" />
        </Link>
      ) : null}
    </nav>
  );
}

export function RetryButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-[#4C1268] px-4 text-sm font-semibold text-white hover:bg-[#3D0E54] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:opacity-60"
    >
      <FiRefreshCw aria-hidden="true" />
      {isPending ? "Trying again…" : "Try again"}
    </button>
  );
}
