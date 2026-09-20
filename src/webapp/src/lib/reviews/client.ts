import { apiRequest, apiUploadRequest, initializeCsrf } from "@/lib/api";

import type {
  ProductReview,
  ProductReviewPhoto,
  ProductReviewsResponse,
} from "./types";

export function fetchProductReviews(
  productId: string,
  page = 1,
  limit = 10,
  signal?: AbortSignal,
) {
  const parameters = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  return apiRequest<ProductReviewsResponse>(
    `/api/v1/products/${encodeURIComponent(productId)}/reviews?${parameters.toString()}`,
    { signal, cache: "no-store" },
  );
}

export async function createProductReview(
  orderItemId: string,
  rating: number,
  body: string,
) {
  await initializeCsrf();
  return apiRequest<{ data: ProductReview }>(
    `/api/v1/customer/order-items/${encodeURIComponent(orderItemId)}/review`,
    {
      method: "POST",
      body: JSON.stringify({ rating, body }),
      cache: "no-store",
    },
  );
}

export function uploadProductReviewImage(
  reviewId: string,
  file: File,
  onProgress?: (percent: number) => void,
) {
  const body = new FormData();
  body.append("image", file);

  return apiUploadRequest<{ data: ProductReviewPhoto }>(
    `/api/v1/customer/reviews/${encodeURIComponent(reviewId)}/images`,
    body,
    onProgress,
  );
}
