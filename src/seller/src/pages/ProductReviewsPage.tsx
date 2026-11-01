import { useEffect, useState } from 'react'
import { FaRotateRight } from 'react-icons/fa6'
import { Link, useSearchParams } from 'react-router-dom'
import { PortalPagination, PortalSkeleton, PortalState, PortalTable } from '@aisley/ui/portal'
import '../features/productFeedback/feedback.css'
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
    <div className="portal-page seller-feedback">
      <header className="portal-page-header">
        <div>
          <h1 className="portal-page-heading">Product reviews</h1>
          <p className="portal-page-description">Read verified Customer feedback and publish one official Shop response.</p>
        </div>
        <button aria-label="Refresh Product reviews" className="portal-button" disabled={loading} onClick={() => setReload((value) => value + 1)} type="button">
          <FaRotateRight aria-hidden="true" /> Refresh
        </button>
      </header>
      <div className="portal-filter-bar feedback-filters feedback-review-filters">
        <label>Response state
          <select className="portal-input" onChange={(event) => updateFilter('status', event.target.value)} value={status}>
            {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Product
          <select className="portal-input" onChange={(event) => updateFilter('product', event.target.value)} value={product}>
            <option value="">All products</option>
            {page?.filters.products.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
        </label>
        <label>Rating
          <select className="portal-input" onChange={(event) => updateFilter('rating', event.target.value)} value={rating}>
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
          </select>
        </label>
      </div>
      {error ? <PortalState error title={error} action={<button className="portal-button" onClick={() => setReload((value) => value + 1)} type="button">Try again</button>} />
        : loading ? <PortalSkeleton label="Loading Product reviews…" />
        : page?.data.length === 0 ? <PortalState title={filtered ? 'No reviews match these filters.' : 'No Product reviews yet.'} description="Verified reviews appear after Customers receive their Orders." />
        : page ? <>
          <PortalTable label="Product reviews">
            <caption>{page.meta.total} {page.meta.total === 1 ? 'review' : 'reviews'} · Submitted in Asia/Manila</caption>
            <thead><tr><th scope="col">Product</th><th scope="col">Rating and review</th><th scope="col">Response</th><th scope="col">Submitted</th><th scope="col" className="portal-row-action">Action</th></tr></thead>
            <tbody>{page.data.map((review) => <tr key={review.id}>
              <td className="portal-table-name">
                <Link className="portal-link font-medium" to={`/reviews/${review.id}`}>{review.product.name}</Link>
                {review.variant?.name ? <span className="portal-table-meta">{review.variant.name}</span> : null}
                <span className="portal-table-meta">Verified purchase</span>
              </td>
              <td className="feedback-text"><ReviewRating rating={review.rating} /><p className="mt-2 line-clamp-2">{review.body}</p></td>
              <td><span className={`portal-tag portal-tag-${review.responseState === 'unanswered' ? 'warning' : 'success'}`}>{review.responseState === 'unanswered' ? 'Needs response' : 'Responded'}</span></td>
              <td className="feedback-date"><time dateTime={review.createdAt}>{dateTime(review.createdAt)}</time></td>
              <td className="portal-row-action"><Link className="portal-button portal-button-ghost" to={`/reviews/${review.id}`}>{review.responseState === 'unanswered' ? 'Review' : 'View'}</Link></td>
            </tr>)}</tbody>
          </PortalTable>
          <PortalPagination page={page.meta.current_page} lastPage={page.meta.last_page} total={page.meta.total} onPage={movePage} />
        </> : null}
    </div>
  )
}
