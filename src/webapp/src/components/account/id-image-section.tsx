"use client";

import { Button } from "@aisley/ui";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { FiCheckCircle, FiTrash2, FiUpload } from "react-icons/fi";

import {
  removeCustomerIdImage,
  uploadCustomerIdImage,
} from "@/lib/account/client";
import type {
  CustomerAccount,
  CustomerPhotoMutationResponse,
} from "@/lib/account/types";
import { ApiError, firstFieldError } from "@/lib/api";

const maximumBytes = 10 * 1024 * 1024;
const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function selectedFileError(file: File) {
  const parts = file.name.split(".");
  const extension = parts.at(-1)?.toLocaleLowerCase() ?? "";

  if (parts.length > 2) {
    return "The ID image filename must not contain multiple extensions.";
  }
  if (!allowedExtensions.has(extension) || !allowedTypes.has(file.type)) {
    return "Choose a JPEG, PNG, or WebP image.";
  }
  if (file.size >= maximumBytes) {
    return "The ID image must be smaller than 10 MB.";
  }

  return null;
}

export function IdImageSection({
  account,
  onUpdated,
}: {
  account: CustomerAccount;
  onUpdated: (response: CustomerPhotoMutationResponse) => void;
}) {
  const [selected, setSelected] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  useEffect(() => {
    if (error || message) feedbackRef.current?.focus();
  }, [error, message]);

  function clearSelection() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setMessage(null);

    if (!file) {
      clearSelection();
      return;
    }

    const validationError = selectedFileError(file);
    if (validationError) {
      clearSelection();
      setError(
        new ApiError(422, {
          errors: { id_image: [validationError] },
          message: validationError,
        }),
      );
      return;
    }

    clearSelection();
    const previewUrl = URL.createObjectURL(file);
    previewRef.current = previewUrl;
    setSelected({ file, previewUrl });
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;

    setBusy("upload");
    setProgress(0);
    setError(null);
    setMessage(null);

    try {
      const response = await uploadCustomerIdImage(selected.file, setProgress);
      onUpdated(response);
      clearSelection();
      setMessage(response.message);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, { message: "We could not upload your ID image." }),
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy("remove");
    setError(null);
    setMessage(null);

    try {
      const response = await removeCustomerIdImage();
      onUpdated(response);
      clearSelection();
      setConfirmingRemove(false);
      setMessage(response.message);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, { message: "We could not remove your ID image." }),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="id-image-heading"
      className="mt-5 border border-[#DED7E1] bg-white p-5 sm:p-6"
    >
      <h2
        id="id-image-heading"
        className="text-base font-semibold text-[#302534]"
      >
        ID image (optional)
      </h2>
      <p className="mt-1 text-sm leading-6 text-[#746978]">
        JPEG, PNG, or WebP. Smaller than 10 MB. This image is private to your account.
      </p>

      {error || message ? (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role={error ? "alert" : "status"}
          className={`mt-4 flex items-start gap-2 border-l-2 px-3 py-2 text-sm outline-none ${
            error
              ? "border-[#B42318] bg-[#FFF4F2] text-[#9A271E]"
              : "border-[#3F6846] bg-[#F3F8F4] text-[#315637]"
          }`}
        >
          {!error ? (
            <FiCheckCircle aria-hidden="true" className="mt-0.5 shrink-0" />
          ) : null}
          <span>{firstFieldError(error, "id_image") ?? error?.message ?? message}</span>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <form onSubmit={upload}>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-[#CFC6D2] bg-white px-3 text-sm font-semibold text-[#4C1268] hover:bg-[#F8F5F8] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#4C1268]">
                <FiUpload aria-hidden="true" /> Choose ID image
                <input
                  ref={inputRef}
                  className="sr-only"
                  type="file"
                  name="id_image"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  disabled={busy !== null}
                  onChange={chooseImage}
                />
              </label>
              {selected ? (
                <span className="max-w-64 truncate text-sm text-[#675B6B]">
                  {selected.file.name}
                </span>
              ) : null}
              <Button
                type="submit"
                className="min-h-11 rounded-md px-4"
                disabled={!selected || busy !== null}
                isLoading={busy === "upload"}
                loadingLabel="Uploading"
              >
                Upload image
              </Button>
              {account.profile.idImageUrl ? (
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(true)}
                  disabled={busy !== null}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold text-[#9D174D] hover:bg-[#FFF1F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4C1268] disabled:opacity-60"
                >
                  <FiTrash2 aria-hidden="true" /> Remove
                </button>
              ) : null}
            </div>
          </form>

          {busy === "upload" ? (
            <div className="mt-3" role="status" aria-live="polite">
              <div className="flex justify-between text-xs text-[#675B6B]">
                <span>Uploading and saving</span>
                <span>{progress}%</span>
              </div>
              <progress
                className="mt-1 h-2 w-full accent-[#4C1268]"
                max={100}
                value={progress}
              >
                {progress}%
              </progress>
            </div>
          ) : null}

          {selected ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E9E4EB] pt-4">
              {/* Local preview is revoked when replaced, saved, or unmounted. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.previewUrl}
                alt="Selected ID image preview"
                className="max-h-48 max-w-full object-contain"
              />
              <p className="text-sm leading-6 text-[#746978]">
                Preview only. Your saved image changes after the upload succeeds.
              </p>
            </div>
          ) : null}
        </div>

        {account.profile.idImageUrl ? (
          <figure className="w-full max-w-xs">
            {/* This image URL is private and authorized by the account API. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={account.profile.idImageUrl}
              alt="Your saved ID image"
              className="max-h-56 w-full border border-[#DED7E1] object-contain"
            />
            <figcaption className="mt-2 text-sm text-[#746978]">
              Saved ID image
            </figcaption>
          </figure>
        ) : null}
      </div>

      {confirmingRemove ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#E9E4EB] pt-4">
          <p className="text-sm text-[#514656]">Remove your saved ID image?</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-md px-3"
              onClick={() => setConfirmingRemove(false)}
              disabled={busy !== null}
            >
              Keep image
            </Button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy !== null}
              className="min-h-11 rounded-md bg-[#B42318] px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "remove" ? "Removing…" : "Remove image"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
