export type ProductReviewPhoto = {
  id: string;
  url: string;
  mimeType: string;
  width: number;
  height: number;
};

export type ProductReview = {
  id: string;
  rating: number;
  body: string;
  verifiedPurchase: boolean;
  authorLabel: string;
  createdAt: string | null;
  photos: ProductReviewPhoto[];
  sellerResponse: {
    body: string;
    createdAt: string | null;
  } | null;
};

export type ProductReviewSummary = {
  averageRating: number | null;
  reviewCount: number;
  distribution: Record<string, number>;
};

export type ProductReviewsResponse = {
  data: ProductReview[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    path: string;
    per_page: number;
    to: number | null;
    total: number;
  };
  summary: ProductReviewSummary;
};
