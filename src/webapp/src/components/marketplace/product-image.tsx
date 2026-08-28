"use client";

import Image from "next/image";
import { useState } from "react";

export function ProductImage({
  alt,
  priority = false,
  sizes,
  src,
}: {
  alt: string;
  priority?: boolean;
  sizes: string;
  src: string | null;
}) {
  const fallback = "/aisley-logo.svg";
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const imageSource = src && src !== failedSource ? src : fallback;

  const isFallback = imageSource === fallback;

  return (
    <Image
      src={imageSource}
      alt={isFallback ? "" : alt}
      fill
      sizes={sizes}
      priority={priority}
      onError={() => {
        if (imageSource !== fallback) {
          setFailedSource(imageSource);
        }
      }}
      className={
        isFallback
          ? "object-contain p-[28%] opacity-35"
          : "object-cover"
      }
    />
  );
}
