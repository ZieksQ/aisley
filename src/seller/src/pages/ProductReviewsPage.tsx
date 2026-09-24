import { useEffect, useState } from 'react'
import { FaRotateRight, FaStar } from 'react-icons/fa6'
import { Link, useSearchParams } from 'react-router-dom'
import { ReviewRating } from '../components/reviews/ReviewRating'
import { ApiError } from '../lib/api'
import { listProductReviews } from '../lib/reviews'
import type { SellerReviewPage, SellerReviewStatus } from '../types/reviews'

const statusOptions: Array<[SellerReviewStatus, string]> = [
  ['all', 'All responses'],
  ['unanswered', 'Needs a response'],
  ['answered', 'Responded'],
]

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function loadError(reason: unknown) {
  if (!(reason instanceof ApiError)) return 'Product reviews could not be loaded.'
  if (reason.status === 401) return 'Your Seller session expired. Sign in again and retry.'
  if (reason.status === 403) return 'Your Seller account cannot access reviews right now.'
  return reason.message || 'Product reviews could not be loaded.'
}

export function ProductReviewsPage() {
  const [params, setParams] = useSearchParams()
  const requestedStatus = params.get('status')
  const status = statusOptions.some(([value]) => value === requestedStatus)
    ? requestedStatus as SellerReviewStatus
    : 'all'
  const product = params.get('product') ?? ''
  const rating = /^[1-5]$/.test(params.get('rating') ?? '') ? params.get('rating') ?? '' : ''
  const pageNumber = Math.max(1, Number(params.get('page')) || 1)
  const [page, setPage] = useState<SellerReviewPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    document.title = 'Product reviews | Aisley Seller'
    setLoading(true)
    setError('')
    listProductReviews({ status, product, rating, page: pageNumber })
      .then((result) => {
        if (active) setPage(result)
      })
      .catch((reason: unknown) => {
        if (active) setError(loadError(reason))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [pageNumber, product, rating, reload, status])

  function updateFilter(key: 'status' | 'product' | 'rating', value: string) {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next)
  }

  function movePage(nextPage: number) {
    const next = new URLSearchParams(params)
    if (nextPage > 1) next.set('page', String(nextPage))
    else next.delete('page')
    setParams(next)
  }

  const filtered = status !== 'all' || product !== '' || rating !== ''

  return (
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-white/10">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Product reviews</h2>
          <p className="mt-1 text-sm text-zinc-500">Read verified Customer feedback and publish one official Shop response.</p>
        </div>
        <button
          aria-label="Refresh Product reviews"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
          onClick={() => setReload((value) => value + 1)}
          type="button"
        >
          <FaRotateRight aria-hidden="true" /> Refresh
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Response state
          <select
            className="mt-2 block h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#18181b]"
            onChange={(event) => updateFilter('status', event.target.value)}
            value={status}
          >
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Product
          <select
            className="mt-2 block h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#18181b]"
            onChange={(event) => updateFilter('product', event.target.value)}
            value={product}
          >
            <option value="">All products</option>
            {page?.filters.products.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">
          Rating
          <select
            className="mt-2 block h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-white/15 dark:bg-[#18181b]"
            onChange={(event) => updateFilter('rating', event.target.value)}
            value={rating}
          >
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
          </select>
        </label>
      </div>

      {error ? (
        <div className="mt-5 flex items-center justify-between gap-3 border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">
          <span>{error}</span>
          <button className="shrink-0 font-semibold underline" onClick={() => setReload((value) => value + 1)} type="button">Try again</button>
        </div>
      ) : null}
      {loading ? <p className="py-12 text-center text-sm text-zinc-500" role="status">Loading Product reviews…</p> : null}
      {!loading && !error && page?.data.length === 0 ? (
        <div className="mt-5 border border-dashed border-zinc-300 bg-white px-5 py-12 text-center dark:border-white/15 dark:bg-[#18181b]">
          <FaStar aria-hidden="true" className="mx-auto text-zinc-400" />
          <p className="mt-3 text-sm font-medium">{filtered ? 'No reviews match these filters.' : 'No Product reviews yet.'}</p>
          <p className="mt-1 text-sm text-zinc-500">Verified reviews appear after Customers receive their Orders.</p>
        </div>
      ) : null}
      {!loading && !error && page && page.data.length > 0 ? (
        <>
          <p className="mb-3 mt-5 text-sm text-zinc-600 dark:text-zinc-400">
            {page.meta.total} {page.meta.total === 1 ? 'review' : 'reviews'}
          </p>
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#18181b]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-500 dark:border-white/10 dark:bg-white/[0.03]">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Rating and review</th>
                    <th className="px-4 py-3">Response</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-white/10">
                  {page.data.map((review) => (
                    <tr className="align-top hover:bg-zinc-50 dark:hover:bg-white/[0.03]" key={review.id}>
                      <td className="px-4 py-4">
                        <p className="font-medium">{review.product.name}</p>
                        {review.variant?.name ? <p className="mt-1 text-xs text-zinc-500">{review.variant.name}</p> : null}
                      </td>
                      <td className="max-w-md px-4 py-4">
                        <ReviewRating rating={review.rating} />
                        <p className="mt-2 line-clamp-2 leading-6 text-zinc-600 dark:text-zinc-300">{review.body}</p>
                      </td>
                      <td className={`px-4 py-4 font-medium ${review.responseState === 'unanswered' ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        {review.responseState === 'unanswered' ? 'Needs response' : 'Responded'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-zinc-500">{dateTime(review.createdAt)}</td>
                      <td className="px-4 py-4 text-right">
                        <Link className="font-medium text-[#4C1268] hover:underline dark:text-purple-300" to={`/reviews/${review.id}`}>
                          {review.responseState === 'unanswered' ? 'Review' : 'View'}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {page.meta.last_page > 1 ? (
            <nav aria-label="Product review pages" className="mt-4 flex items-center justify-between text-sm">
              <button className="rounded-lg border border-zinc-300 px-3 py-2 disabled:opacity-40 dark:border-white/15" disabled={page.meta.current_page <= 1} onClick={() => movePage(page.meta.current_page - 1)} type="button">Previous</button>
              <span className="text-zinc-500">Page {page.meta.current_page} of {page.meta.last_page}</span>
              <button className="rounded-lg border border-zinc-300 px-3 py-2 disabled:opacity-40 dark:border-white/15" disabled={page.meta.current_page >= page.meta.last_page} onClick={() => movePage(page.meta.current_page + 1)} type="button">Next</button>
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
