"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HiStar } from "react-icons/hi2";

import { useAuth } from "@/components/auth/auth-provider";
import { ApiError } from "@/lib/api";
import { fetchProductReviews } from "@/lib/reviews/client";
import type {
  ProductReview,
  ProductReviewsResponse,
  ProductReviewSummary,
} from "@/lib/reviews/types";

const reviewLimit = 10;

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";

  try {
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return "Date unavailable";
  }
}

function errorMessage(error: ApiError | null) {
  if (!error) return "We could not load Product reviews.";
  if (error.status === 429) return "Reviews are temporarily rate-limited. Please try again shortly.";
  if (error.status === 404) return "This Product is no longer available.";
  return error.message || "We could not load Product reviews.";
}

export function ProductReviewsSection({ productId }: { productId: string }) {
  const { auth } = useAuth();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [summary, setSummary] = useState<ProductReviewSummary | null>(null);
  const [pagination, setPagination] = useState<ProductReviewsResponse["meta"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<ApiError | null>(null);

  const load = useCallback(async (page: number, append: boolean, signal?: AbortSignal) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const response = await fetchProductReviews(productId, page, reviewLimit, signal);
      setReviews((current) => append ? [...current, ...response.data] : response.data);
      setSummary(response.summary);
      setPagination(response.meta);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setLoadError(caught instanceof ApiError
        ? caught
        : new ApiError(0, { message: "We could not load Product reviews." }));
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    const controller = new AbortController();
    const task = window.setTimeout(() => void load(1, false, controller.signal), 0);
    return () => {
      window.clearTimeout(task);
      controller.abort();
    };
  }, [load]);

  const loginPath = `/login?next=${encodeURIComponent(`/products/${productId}#product-reviews`)}`;

  return (
    <section id="product-reviews" aria-labelledby="product-reviews-heading" className="border-t border-[#E3DDE5] pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="product-reviews-heading" className="text-xl font-semibold text-[#2D2231]">Verified-purchase reviews</h2>
          <p className="mt-1 text-sm text-[#746978]">Reviews are available after a delivered Order item.</p>
        </div>
        {summary ? <p className="text-sm text-[#746978]">{summary.reviewCount.toLocaleString("en-PH")} reviews</p> : null}
      </div>

      {summary && summary.reviewCount > 0 ? <ReviewSummary summary={summary} /> : null}

      {auth.status === "guest" ? (
        <p className="mt-4 text-sm text-[#746978]">
          <Link href={loginPath} className="font-semibold text-[#4C1268] underline-offset-2 hover:text-[#E6007A] hover:underline focus-visible:outline-2 focus-visible:outline-[#E6007A]">Sign in</Link>{" "}to manage reviews for your delivered purchases.
        </p>
      ) : null}

      <div aria-live="polite" className="mt-6">
        {loading ? <p className="py-6 text-sm text-[#746978]">Loading reviews…</p> : null}
        {!loading && loadError ? (
          <div role="alert" className="border-y border-[#E8E2EA] py-5">
            <p className="text-sm text-[#B42318]">{errorMessage(loadError)}</p>
            <button type="button" onClick={() => void load(1, false)} className="mt-3 text-sm font-semibold text-[#4C1268] underline-offset-2 hover:text-[#E6007A] hover:underline focus-visible:outline-2 focus-visible:outline-[#E6007A]">Try again</button>
          </div>
        ) : null}
        {!loading && !loadError && reviews.length === 0 ? (
          <p className="border-y border-[#E8E2EA] py-6 text-sm text-[#746978]">No verified-purchase reviews yet.</p>
        ) : null}
        {!loading && !loadError && reviews.length > 0 ? (
          <div className="divide-y divide-[#E8E2EA] border-y border-[#E8E2EA]">
            {reviews.map((review) => <ProductReviewItem key={review.id} review={review} />)}
          </div>
        ) : null}
        {pagination && pagination.current_page < pagination.last_page ? (
          <button
            type="button"
            onClick={() => void load(pagination.current_page + 1, true)}
            disabled={loadingMore}
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md border border-[#BDAFC2] px-4 text-sm font-semibold text-[#4C1268] hover:border-[#7C6684] hover:bg-[#F9F6FA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more reviews"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ReviewSummary({ summary }: { summary: ProductReviewSummary }) {
  const average = summary.averageRating ?? 0;

  return (
    <div className="mt-5 grid gap-5 border-y border-[#E8E2EA] py-5 sm:grid-cols-[180px_minmax(0,1fr)]">
      <div>
        <p className="text-3xl font-semibold text-[#2D2231]">{average.toFixed(1)}<span className="ml-1 text-base font-normal text-[#746978]">/ 5</span></p>
        <StarRating rating={average} label={`${average.toFixed(1)} out of 5 stars`} />
      </div>
      <div className="space-y-1.5" aria-label="Review rating distribution">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = summary.distribution[String(rating)] ?? 0;
          const width = summary.reviewCount > 0 ? `${(count / summary.reviewCount) * 100}%` : "0%";
          return (
            <div key={rating} className="grid grid-cols-[44px_minmax(0,1fr)_36px] items-center gap-2 text-xs text-[#746978]">
              <span>{rating} stars</span>
              <span className="h-2 overflow-hidden bg-[#EEE9EF]"><span className="block h-full bg-[#FF8800]" style={{ width }} /></span>
              <span className="text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductReviewItem({ review }: { review: ProductReview }) {
  return (
    <article className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StarRating rating={review.rating} label={`${review.rating} out of 5 stars`} />
          {review.verifiedPurchase ? <span className="text-xs font-semibold text-[#176B45]">Verified purchase</span> : null}
        </div>
        <time dateTime={review.createdAt ?? undefined} className="text-xs text-[#746978]">{formatDate(review.createdAt)}</time>
      </div>
      <p className="mt-2 text-sm font-medium text-[#3D3241]">{review.authorLabel}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#302534]">{review.body}</p>
      {review.photos.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {review.photos.map((photo) => (
            // The API returns a visibility-checked, safe media URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={photo.id} src={photo.url} alt="Customer review photo" loading="lazy" className="size-20 border border-[#DED7E1] object-cover" />
          ))}
        </div>
      ) : null}
      {review.sellerResponse ? (
        <div className="mt-4 border-l-2 border-[#C9BBCD] pl-4">
          <p className="text-sm font-semibold text-[#4C1268]">Seller response</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#4F4453]">{review.sellerResponse.body}</p>
        </div>
      ) : null}
    </article>
  );
}

function StarRating({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="flex gap-0.5 text-[#FF8800]" aria-label={label} role="img">
      {Array.from({ length: 5 }, (_, index) => (
        <HiStar key={index} aria-hidden="true" className={`size-4 ${index + 1 > Math.round(rating) ? "text-[#D8D0DA]" : ""}`} />
      ))}
    </span>
  );
}
