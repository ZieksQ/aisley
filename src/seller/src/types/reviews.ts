export type SellerReviewStatus = 'all' | 'unanswered' | 'answered'

export type SellerReviewPhoto = {
  id: string
  url: string
  mimeType: string
  width: number
  height: number
}

export type SellerReviewResponse = {
  id: string
  shopName: string
  body: string
  status: 'published'
  publishedAt: string
}

export type SellerProductReview = {
  id: string
  rating: number
  body: string
  verifiedPurchase: true
  authorLabel: 'Verified Customer'
  createdAt: string
  responseState: 'unanswered' | 'answered'
  sellerResponse: SellerReviewResponse | null
  product: {
    id: string
    name: string
    currentName: string | null
    status: 'draft' | 'active' | 'archived' | null
    isDeleted: boolean
  }
  variant: null | {
    id: string | null
    name: string | null
  }
  photos: SellerReviewPhoto[]
}

export type SellerReviewPage = {
  data: SellerProductReview[]
  filters: {
    products: Array<{ id: string; name: string }>
  }
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
