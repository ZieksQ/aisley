import { apiRequest, initializeCsrf } from './api'
import type { SellerProductReview, SellerReviewPage, SellerReviewStatus } from '../types/reviews'

type ReviewFilters = {
  status: SellerReviewStatus
  product: string
  rating: string
  page: number
}

export function listProductReviews(filters: ReviewFilters) {
  const query = new URLSearchParams({
    per_page: '20',
    page: String(filters.page),
  })
  if (filters.status !== 'all') query.set('status', filters.status)
  if (filters.product) query.set('product', filters.product)
  if (filters.rating) query.set('rating', filters.rating)

  return apiRequest<SellerReviewPage>(`/api/v1/seller/reviews?${query}`)
}

export function getProductReview(id: string) {
  return apiRequest<{ data: SellerProductReview }>(`/api/v1/seller/reviews/${encodeURIComponent(id)}`)
}

export async function publishReviewResponse(id: string, response: string, idempotencyKey: string) {
  await initializeCsrf()

  return apiRequest<{ data: SellerProductReview }>(`/api/v1/seller/reviews/${encodeURIComponent(id)}/response`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ response }),
  })
}
