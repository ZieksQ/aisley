"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { ApiError, firstFieldError } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import {
  askProductQuestion,
  fetchProductQuestions,
} from "@/lib/marketplace/client";
import type {
  ProductQuestion,
  ProductQuestionsResponse,
} from "@/lib/marketplace/types";

const questionLimit = 10;

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";

  try {
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return "Date unavailable";
  }
}

function errorMessage(error: ApiError | null, fallback: string) {
  if (!error) return fallback;
  if (error.status === 429) return "You have reached the question limit. Please try again later.";
  if (error.status === 401) return "Your session has expired. Sign in again to ask a question.";
  if (error.status === 404) return "This Product is no longer available.";

  return error.message || fallback;
}

export function ProductQASection({ productId }: { productId: string }) {
  const { auth } = useAuth();
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [pagination, setPagination] = useState<ProductQuestionsResponse["meta"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async (page: number, append: boolean, signal?: AbortSignal) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const response = await fetchProductQuestions(productId, page, questionLimit, signal);
      setQuestions((current) => append ? [...current, ...response.data] : response.data);
      setPagination(response.meta);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setLoadError(caught instanceof ApiError ? caught : new ApiError(0, { message: "We could not load Product questions." }));
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      await askProductQuestion(productId, draft);
      setDraft("");
      setSuccess("Your question was posted.");
      await load(1, false);
    } catch (caught) {
      setSubmitError(caught instanceof ApiError ? caught : new ApiError(0, { message: "We could not post your question." }));
    } finally {
      setSubmitting(false);
    }
  }

  const loginPath = `/login?next=${encodeURIComponent(`/products/${productId}#product-qa`)}`;

  return (
    <section id="product-qa" aria-labelledby="product-qa-heading" className="border-t border-[#E3DDE5] pt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 id="product-qa-heading" className="text-xl font-semibold text-[#2D2231]">Questions &amp; answers</h2>
          <p className="mt-1 text-sm text-[#746978]">Ask the shop a question before you buy.</p>
        </div>
        {pagination ? <p className="text-sm text-[#746978]">{pagination.total.toLocaleString("en-PH")} questions</p> : null}
      </div>

      {auth.status === "authenticated" ? (
        <form onSubmit={handleSubmit} className="mt-5 border-y border-[#E8E2EA] py-5">
          <label htmlFor="product-question" className="block text-sm font-semibold text-[#3D3241]">Ask a question</label>
          <textarea
            id="product-question"
            name="question"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={1000}
            rows={3}
            disabled={submitting}
            aria-describedby="product-question-hint product-question-count"
            aria-invalid={Boolean(firstFieldError(submitError, "question"))}
            className="mt-2 block w-full resize-y rounded-md border border-[#CFC4D2] bg-white px-3 py-2.5 text-sm leading-6 text-[#2D2231] outline-none placeholder:text-[#968A99] focus:border-[#4C1268] focus:ring-2 focus:ring-[#4C1268]/15 disabled:bg-[#F7F4F8]"
            placeholder="What would you like to know about this product?"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#746978]">
            <span id="product-question-hint">Plain text only. Do not include personal information.</span>
            <span id="product-question-count">{draft.length}/1000</span>
          </div>
          {firstFieldError(submitError, "question") ? <p role="alert" className="mt-2 text-sm text-[#B42318]">{firstFieldError(submitError, "question")}</p> : null}
          {submitError && !firstFieldError(submitError, "question") ? <p role="alert" className="mt-2 text-sm text-[#B42318]">{errorMessage(submitError, "We could not post your question.")}</p> : null}
          {success ? <p role="status" className="mt-2 text-sm text-[#176B45]">{success}</p> : null}
          <button
            type="submit"
            disabled={submitting || draft.trim().length === 0}
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-md bg-[#E6007A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#C9006B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Posting…" : "Post question"}
          </button>
        </form>
      ) : auth.status === "guest" ? (
        <div className="mt-5 border-y border-[#E8E2EA] py-4 text-sm text-[#4F4453]">
          <Link href={loginPath} className="font-semibold text-[#4C1268] underline-offset-2 hover:text-[#E6007A] hover:underline focus-visible:outline-2 focus-visible:outline-[#E6007A]">Sign in</Link>{" "}to ask a question. You can still read answers below.
        </div>
      ) : null}

      <div aria-live="polite" className="mt-6">
        {loading ? <p className="py-6 text-sm text-[#746978]">Loading questions…</p> : null}
        {!loading && loadError ? (
          <div role="alert" className="border-y border-[#E8E2EA] py-5">
            <p className="text-sm text-[#B42318]">{errorMessage(loadError, "We could not load Product questions.")}</p>
            <button type="button" onClick={() => void load(1, false)} className="mt-3 text-sm font-semibold text-[#4C1268] underline-offset-2 hover:text-[#E6007A] hover:underline focus-visible:outline-2 focus-visible:outline-[#E6007A]">Try again</button>
          </div>
        ) : null}
        {!loading && !loadError && questions.length === 0 ? <p className="border-y border-[#E8E2EA] py-6 text-sm text-[#746978]">No questions yet. Be the first to ask.</p> : null}
        {!loading && !loadError && questions.length > 0 ? (
          <div className="divide-y divide-[#E8E2EA] border-y border-[#E8E2EA]">
            {questions.map((item) => <ProductQAItem key={item.id} item={item} />)}
          </div>
        ) : null}
        {pagination && pagination.current_page < pagination.last_page ? (
          <button
            type="button"
            onClick={() => void load(pagination.current_page + 1, true)}
            disabled={loadingMore}
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-md border border-[#BDAFC2] px-4 text-sm font-semibold text-[#4C1268] hover:border-[#7C6684] hover:bg-[#F9F6FA] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "Loading…" : "Load more questions"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ProductQAItem({ item }: { item: ProductQuestion }) {
  return (
    <article className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#3D3241]">Customer question</h3>
        <time dateTime={item.askedAt ?? undefined} className="text-xs text-[#746978]">{formatDate(item.askedAt)}</time>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#302534]">{item.question}</p>
      {item.answer ? (
        <div className="mt-4 border-l-2 border-[#C9BBCD] pl-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-[#4C1268]">{item.sellerLabel ?? "Seller"}</p>
            <time dateTime={item.answeredAt ?? undefined} className="text-xs text-[#746978]">{formatDate(item.answeredAt)}</time>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#4F4453]">{item.answer}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#746978]">The seller has not answered this question yet.</p>
      )}
    </article>
  );
}
