// Synthetic Shop data. Requests are intercepted before the app loads.
export function installFeedbackFixtures() {
  const fallback = window.fetch.bind(window)
  const question = {
    id: 'question-1', question: 'Will the large basket fit a shelf that is 30 cm deep?',
    state: 'unanswered', askedAt: '2026-10-29T08:34:00Z', answeredAt: null, answer: null,
    product: { id: 'product-1', name: 'Cedar Storage Basket', slug: 'cedar-storage-basket', status: 'active', publishedAt: '2026-10-01T00:00:00Z' },
  }
  const review = {
    id: 'review-1', rating: 4, body: 'The weave is sturdy and the handles make it easy to carry. The natural finish matches our shelves.',
    verifiedPurchase: true, authorLabel: 'Verified Customer', createdAt: '2026-10-30T07:12:00Z',
    responseState: 'unanswered', sellerResponse: null, photos: [], variant: { id: 'variant-1', name: 'Natural / Large' },
    product: { id: 'product-1', name: 'Cedar Storage Basket', currentName: 'Cedar Storage Basket', status: 'active', isDeleted: false },
  }
  window.feedbackFixture = { mode: 'normal', writes: [] }
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.origin)
    const isQuestion = url.pathname.startsWith('/api/v1/seller/product-questions')
    const isReview = url.pathname.startsWith('/api/v1/seller/reviews')
    if (!isQuestion && !isReview) return fallback(input, options)
    const state = window.feedbackFixture
    if (state.mode === 'error') return reply({ message: 'Feedback service is unavailable.' }, 503)
    if (state.mode === 'loading') await new Promise(done => setTimeout(done, 600))
    const item = isQuestion ? question : review
    if (options.method === 'POST') {
      const body = JSON.parse(options.body)
      state.writes.push({ body, key: new Headers(options.headers).get('Idempotency-Key') })
      if (isQuestion) Object.assign(question, { answer: body.answer, state: 'answered', answeredAt: '2026-11-02T03:21:00Z' })
      else Object.assign(review, { responseState: 'answered', sellerResponse: { id: 'response-1', shopName: 'Cedar Home', body: body.response, status: 'published', publishedAt: '2026-11-02T03:21:00Z' } })
      return reply({ data: item })
    }
    if (/\/(question-1|review-1)$/.test(url.pathname)) return reply({ data: item })
    const answerState = isQuestion ? item.state : item.responseState
    const matches = state.mode !== 'empty'
      && (!url.searchParams.get('status') || url.searchParams.get('status') === 'all' || url.searchParams.get('status') === answerState)
      && (!url.searchParams.get('rating') || Number(url.searchParams.get('rating')) === review.rating)
      && (!isQuestion || !url.searchParams.get('product') || question.product.name.toLowerCase().includes(url.searchParams.get('product').toLowerCase()))
    return reply({ data: matches ? [item] : [], meta: { current_page: 1, last_page: 1, total: matches ? 1 : 0, per_page: 20 }, filters: { products: [{ id: 'product-1', name: 'Cedar Storage Basket' }] } })
  }
}
