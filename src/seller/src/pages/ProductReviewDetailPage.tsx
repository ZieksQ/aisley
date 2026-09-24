import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FaArrowLeft } from 'react-icons/fa6'
import { Link, useParams } from 'react-router-dom'
import { ReviewPhotos } from '../components/reviews/ReviewPhotos'
import { ReviewRating } from '../components/reviews/ReviewRating'
import { ApiError } from '../lib/api'
import { getProductReview, publishReviewResponse } from '../lib/reviews'
import type { SellerProductReview } from '../types/reviews'

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value))
}

function errorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback
  if (error.status === 0) return 'The API could not be reached. Check your connection and retry the same response.'
  if (error.status === 401 || error.status === 419) return 'Your Seller session expired. Sign in again and retry.'
  if (error.status === 403) return 'Your Seller account cannot manage this review.'
  if (error.status === 404) return 'This Product review is no longer available to your Shop.'
  if (error.status === 409) return error.message || 'This review was already answered. Refresh to see the committed response.'
  if (error.status === 429) return 'Too many response attempts. Wait a moment before trying again.'
  return error.message || fallback
}

function containsUnsafeMarkup(value: string) {
  const hasControlCharacter = Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127
  })

  return hasControlCharacter
    || /<[^>]*>|!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\)|`|(?:^|\s)(?:#{1,6}\s|[-*+]\s|\d+\.\s)/u.test(value)
}

export function ProductReviewDetailPage() {
  const { reviewId = '' } = useParams()
  const [review, setReview] = useState<SellerProductReview | null>(null)
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reload, setReload] = useState(0)
  const keyRef = useRef<{ key: string; response: string } | null>(null)

  useEffect(() => {
    let active = true
    document.title = 'Product review | Aisley Seller'
    setLoading(true)
    setError('')
    getProductReview(reviewId)
      .then(({ data }) => {
        if (!active) return
        setReview(data)
        setResponse(data.sellerResponse?.body ?? '')
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason, 'This Product review could not be loaded.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [reload, reviewId])

  function updateResponse(value: string) {
    setResponse(value)
    setSubmitError('')
    setSuccess('')
    if (keyRef.current && keyRef.current.response !== value) keyRef.current = null
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')
    setSuccess('')
    const text = response.trim().replace(/\r\n?|\u2028|\u2029/g, '\n')
    if (!text) {
      setSubmitError('Write a response before publishing.')
      return
    }
    if (text.length > 2000) {
      setSubmitError('Responses must be 2,000 characters or fewer.')
      return
    }
    if (containsUnsafeMarkup(text)) {
      setSubmitError('Responses must be plain text without HTML, Markdown, or scripts.')
      return
    }

    const pending = keyRef.current?.response === text
      ? keyRef.current
      : { key: crypto.randomUUID(), response: text }
    keyRef.current = pending
    setSubmitting(true)
    try {
      const result = await publishReviewResponse(reviewId, text, pending.key)
      setReview(result.data)
      setResponse(result.data.sellerResponse?.body ?? text)
      setSuccess('Response published. The Customer will receive an in-app notification.')
      keyRef.current = null
    } catch (reason: unknown) {
      setSubmitError(errorMessage(reason, 'The response could not be published. Retry with the same text.'))
      if (reason instanceof ApiError && reason.status === 409) setReload((value) => value + 1)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-4xl px-4 py-12 text-sm text-zinc-500 sm:px-6 lg:px-8" role="status">Loading Product review…</p>
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:px-8">
        <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#4C1268] hover:underline dark:text-purple-300" to="/reviews">
          <FaArrowLeft aria-hidden="true" /> Back to Product reviews
        </Link>
        <div className="mt-5 border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200" role="alert">
          {error}
          <button className="ml-3 font-semibold underline" onClick={() => setReload((value) => value + 1)} type="button">Try again</button>
        </div>
      </div>
    )
  }

  if (!review) return null

  const listingState = review.product.isDeleted ? 'deleted' : review.product.status

  return (
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-6 lg:px-8">
      <Link className="inline-flex items-center gap-2 text-sm font-medium text-[#4C1268] hover:underline dark:text-purple-300" to="/reviews">
        <FaArrowLeft aria-hidden="true" /> Back to Product reviews
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-5 dark:border-white/10">
        <div>
          <p className="text-sm text-zinc-500">{review.variant?.name ? `${review.product.name} · ${review.variant.name}` : review.product.name}</p>
          <h2 className="mt-1 text-2xl font-semibold">Customer review</h2>
          <p className="mt-1 text-xs capitalize text-zinc-500">Listing status: {listingState ?? 'unavailable'}</p>
        </div>
        <span className={`font-medium ${review.responseState === 'unanswered' ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
          {review.responseState === 'unanswered' ? 'Needs response' : 'Responded'}
        </span>
      </div>

      <section aria-labelledby="customer-review-heading" className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold" id="customer-review-heading">{review.authorLabel}</h3>
            <p className="mt-1 text-xs text-zinc-500">Verified purchase</p>
          </div>
          <time className="text-xs text-zinc-500">{dateTime(review.createdAt)}</time>
        </div>
        <div className="mt-4"><ReviewRating rating={review.rating} /></div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{review.body}</p>
        <ReviewPhotos photos={review.photos} />
      </section>

      {review.sellerResponse ? (
        <section aria-labelledby="shop-response-heading" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-5 dark:border-emerald-400/25 dark:bg-emerald-400/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold" id="shop-response-heading">Response from {review.sellerResponse.shopName}</h3>
            <time className="text-xs text-zinc-500">{dateTime(review.sellerResponse.publishedAt)}</time>
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{review.sellerResponse.body}</p>
          <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-300">Published responses are read-only. Editing and deletion are not enabled.</p>
          {success ? <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300" role="status">{success}</p> : null}
        </section>
      ) : (
        <section aria-labelledby="shop-response-heading" className="mt-5 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#18181b]">
          <h3 className="text-lg font-semibold" id="shop-response-heading">Write an official Shop response</h3>
          <p className="mt-1 text-sm text-zinc-500">Your response becomes public immediately and cannot be edited or deleted in this version.</p>
          <form className="mt-4" onSubmit={submit}>
            <label className="text-sm font-medium" htmlFor="review-response">Response</label>
            <textarea
              aria-describedby="response-help"
              aria-invalid={Boolean(submitError)}
              className="mt-2 min-h-36 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-3 text-sm leading-6 focus:border-[#4C1268] focus:outline-none focus:ring-2 focus:ring-[#4C1268]/20 dark:border-white/15 dark:bg-[#171719]"
              id="review-response"
              maxLength={2000}
              onChange={(event) => updateResponse(event.target.value)}
              placeholder="Respond to the Customer in plain text"
              value={response}
            />
            <p className="mt-2 text-xs text-zinc-500" id="response-help">Plain text only. {response.length}/2,000 characters.</p>
            {submitError ? <p className="mt-3 text-sm text-red-700 dark:text-red-300" role="alert">{submitError}</p> : null}
            <div className="mt-4 flex justify-end">
              <button className="h-10 rounded-lg bg-[#4C1268] px-4 text-sm font-medium text-white hover:bg-[#3d0e54] disabled:opacity-50" disabled={submitting} type="submit">
                {submitting ? 'Publishing…' : 'Publish response'}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
