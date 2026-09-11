import { apiRequest, initializeCsrf } from './api'
import type { SellerProductQuestion, SellerProductQuestionPage } from '../types/productQA'

export type ProductQuestionStatus = 'all' | 'unanswered' | 'answered'

export function listProductQuestions(status: ProductQuestionStatus, product: string, page: number) {
  const query = new URLSearchParams({ status, per_page: '20', page: String(page) })
  if (product.trim()) query.set('product', product.trim())

  return apiRequest<SellerProductQuestionPage>(`/api/v1/seller/product-questions?${query}`)
}

export function getProductQuestion(id: string) {
  return apiRequest<{ data: SellerProductQuestion }>(`/api/v1/seller/product-questions/${encodeURIComponent(id)}`)
}

export async function answerProductQuestion(id: string, answer: string, idempotencyKey: string) {
  await initializeCsrf()

  return apiRequest<{ data: SellerProductQuestion }>(`/api/v1/seller/product-questions/${encodeURIComponent(id)}/answer`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ answer }),
  })
}
