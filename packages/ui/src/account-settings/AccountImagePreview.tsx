"use client";
import { useEffect, useState } from "react";
export function AccountImagePreview({ file }: { file: File | null; }) {
  const [preview, setPreview] = useState<{ file: File; url: string; } | null>(null);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview({ file, url });
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!file || preview?.file !== file) return null;
  return <figure className="account-settings-image-preview">
    <img src={preview.url} alt="Selected profile photo preview" />
    <figcaption>Preview only. Your photo changes after the upload succeeds.
    </figcaption>
  </figure>;
}
export function accountImageError(file: File): string | null {
  const parts = file.name.split(".");
  const extension = parts.at(-1)?.toLowerCase();
  if (parts.length > 2) return "Choose an image filename with one extension.";
  if (!["jpg", "jpeg", "png", "webp"].includes(extension ?? "") || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "Choose a JPEG, PNG, or WebP image.";
  if (file.size >= 10 * 1024 * 1024) return "The image must be smaller than 10 MB.";
  return null;
}
