export type SellerProductQuestion = {
  id: string
  state: 'unanswered' | 'answered'
  question: string
  askedAt: string
  answer: string | null
  answeredAt: string | null
  sellerLabel: string | null
  product: {
    id: string
    name: string
    slug: string
    status: 'draft' | 'active' | 'archived'
    publishedAt: string | null
  }
}

export type SellerProductQuestionPage = {
  data: SellerProductQuestion[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
  links?: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
}
