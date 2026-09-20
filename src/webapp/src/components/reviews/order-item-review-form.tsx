"use client";

import { FormEvent, useState } from "react";
import { HiStar } from "react-icons/hi2";

import { ApiError, firstFieldError } from "@/lib/api";
import {
  createProductReview,
  uploadProductReviewImage,
} from "@/lib/reviews/client";

const maxImageBytes = 10 * 1024 * 1024;
const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const acceptedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

type Props = {
  orderItemId: string;
  productName: string;
  canReview: boolean;
  reviewId: string | null;
  onSubmitted: (reviewId: string) => void;
};

export function OrderItemReviewForm({
  orderItemId,
  productName,
  canReview,
  reviewId,
  onSubmitted,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [createdReviewId, setCreatedReviewId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [uploadError, setUploadError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeReviewId = createdReviewId ?? reviewId;
  if (!canReview && activeReviewId === null) return null;

  function selectFiles(nextFiles: File[]) {
    setSubmitError(null);
    setUploadError(null);
    if (nextFiles.length > 5) {
      setSubmitError(new ApiError(422, { message: "You can attach up to five photos." }));
      return;
    }
    const invalid = nextFiles.find((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      return file.size >= maxImageBytes
        || !acceptedMimeTypes.has(file.type)
        || !acceptedExtensions.has(extension);
    });
    if (invalid) {
      setSubmitError(new ApiError(422, { message: "Photos must be correctly named JPEG, PNG, or WebP files smaller than 10 MiB." }));
      return;
    }
    setFiles(nextFiles);
  }

  async function uploadPendingImages(reviewIdToUpload: string, startAt: number) {
    if (files.length === 0 || startAt >= files.length) {
      setSuccess("Your review was posted.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      for (let index = startAt; index < files.length; index += 1) {
        setUploadProgress(0);
        await uploadProductReviewImage(reviewIdToUpload, files[index], setUploadProgress);
        setUploadedCount(index + 1);
      }
      setSuccess("Your review and photos were posted.");
    } catch (caught) {
      setUploadError(caught instanceof ApiError
        ? caught
        : new ApiError(0, { message: "The review was posted, but a photo could not be uploaded." }));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (rating < 1 || body.trim().length === 0 || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    setUploadError(null);
    setSuccess(null);
    try {
      const response = await createProductReview(orderItemId, rating, body);
      setCreatedReviewId(response.data.id);
      onSubmitted(response.data.id);
      setOpen(false);
      await uploadPendingImages(response.data.id, 0);
    } catch (caught) {
      setSubmitError(caught instanceof ApiError
        ? caught
        : new ApiError(0, { message: "We could not post this review." }));
    } finally {
      setSubmitting(false);
    }
  }

  if (activeReviewId !== null) {
    return (
      <div className="mt-3 border-t border-[#EEE9EF] pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[#176B45]">Reviewed</p>
          {success ? <p role="status" className="text-xs text-[#176B45]">{success}</p> : null}
        </div>
        {uploadError ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p role="alert" className="text-xs text-[#B42318]">{uploadError.message}</p>
            <button
              type="button"
              onClick={() => void uploadPendingImages(activeReviewId, uploadedCount)}
              disabled={uploading}
              className="text-xs font-semibold text-[#4C1268] underline-offset-2 hover:text-[#E6007A] hover:underline disabled:opacity-60"
            >
              Retry photo upload
            </button>
          </div>
        ) : null}
        {uploading ? <p className="mt-2 text-xs text-[#746978]">Uploading photo {uploadedCount + 1} of {files.length} ({uploadProgress}%)…</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-[#EEE9EF] pt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setSubmitError(null); setSuccess(null); }}
          className="text-sm font-semibold text-[#4C1268] underline-offset-2 hover:text-[#E6007A] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
        >
          Rate this product
        </button>
      ) : (
        <form onSubmit={handleSubmit} aria-labelledby={`review-heading-${orderItemId}`}>
          <div className="flex items-center justify-between gap-3">
            <h3 id={`review-heading-${orderItemId}`} className="text-sm font-semibold text-[#3D3241]">Review {productName}</h3>
            <button type="button" onClick={() => setOpen(false)} disabled={submitting} className="text-xs font-semibold text-[#746978] hover:text-[#4C1268] disabled:opacity-60">Close</button>
          </div>
          <fieldset className="mt-3">
            <legend className="text-xs font-semibold text-[#514656]">Rating</legend>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className="cursor-pointer rounded-sm p-1 focus-within:outline-2 focus-within:outline-[#E6007A]">
                  <input
                    type="radio"
                    name={`rating-${orderItemId}`}
                    value={value}
                    checked={rating === value}
                    onChange={() => setRating(value)}
                    className="sr-only"
                  />
                  <HiStar aria-hidden="true" className={`size-5 ${value <= rating ? "text-[#FF8800]" : "text-[#D8D0DA]"}`} />
                  <span className="sr-only">{value} {value === 1 ? "star" : "stars"}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor={`review-body-${orderItemId}`} className="mt-3 block text-xs font-semibold text-[#514656]">Comment</label>
          <textarea
            id={`review-body-${orderItemId}`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={2000}
            disabled={submitting}
            placeholder="Share your experience with this Product."
            className="mt-1 block w-full resize-y rounded-md border border-[#CFC4D2] bg-white px-3 py-2 text-sm leading-6 text-[#2D2231] outline-none placeholder:text-[#968A99] focus:border-[#4C1268] focus:ring-2 focus:ring-[#4C1268]/15 disabled:bg-[#F7F4F8]"
          />
          <div className="mt-1 flex justify-between gap-3 text-xs text-[#746978]"><span>Plain text only.</span><span>{body.length}/2000</span></div>
          <label htmlFor={`review-images-${orderItemId}`} className="mt-3 block text-xs font-semibold text-[#514656]">Photos <span className="font-normal text-[#746978]">(optional, up to 5)</span></label>
          <input
            id={`review-images-${orderItemId}`}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            disabled={submitting}
            onChange={(event) => selectFiles(Array.from(event.target.files ?? []))}
            className="mt-1 block w-full text-xs text-[#514656] file:mr-3 file:rounded-md file:border-0 file:bg-[#F1E8F4] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#4C1268] hover:file:bg-[#E6D7EB]"
          />
          {firstFieldError(submitError, "rating") ? <p role="alert" className="mt-2 text-xs text-[#B42318]">{firstFieldError(submitError, "rating")}</p> : null}
          {firstFieldError(submitError, "body") ? <p role="alert" className="mt-2 text-xs text-[#B42318]">{firstFieldError(submitError, "body")}</p> : null}
          {submitError && !firstFieldError(submitError, "rating") && !firstFieldError(submitError, "body") ? <p role="alert" className="mt-2 text-xs text-[#B42318]">{submitError.message}</p> : null}
          <button
            type="submit"
            disabled={submitting || rating < 1 || body.trim().length === 0}
            className="mt-3 inline-flex min-h-9 items-center justify-center rounded-md bg-[#E6007A] px-3 text-xs font-semibold text-white hover:bg-[#C9006B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Posting…" : "Post review"}
          </button>
        </form>
      )}
    </div>
  );
}
