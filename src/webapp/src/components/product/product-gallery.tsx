"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { HiChevronLeft, HiChevronRight, HiPhoto } from "react-icons/hi2";

import type { ProductMedia } from "@/lib/marketplace/types";

export function ProductGallery({
  media,
  preferredMediaId,
  productTitle,
}: {
  media: ProductMedia[];
  preferredMediaId: string | null;
  productTitle: string;
}) {
  const preferredIndex = preferredMediaId
    ? media.findIndex((item) => item.id === preferredMediaId)
    : -1;
  const [selectedIndex, setSelectedIndex] = useState(
    preferredIndex >= 0 ? preferredIndex : 0,
  );
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const touchStartX = useRef<number | null>(null);
  const current = media[selectedIndex] ?? null;

  function move(offset: number) {
    if (media.length < 2) return;
    setSelectedIndex((index) => (index + offset + media.length) % media.length);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  }

  const failed = current ? failedUrls.includes(current.url) : true;

  return (
    <section aria-label="Product images" className="min-w-0">
      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const distance = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
          if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1);
          touchStartX.current = null;
        }}
        className="group relative aspect-square overflow-hidden rounded-lg border border-[#DED7E1] bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
        aria-label={`${productTitle} image ${selectedIndex + 1} of ${Math.max(media.length, 1)}. Use left and right arrow keys to browse.`}
      >
        {current && !failed ? (
          <Image
            src={current.url}
            alt={current.altText}
            fill
            priority
            sizes="(max-width: 767px) 100vw, (max-width: 1279px) 52vw, 640px"
            onError={() => setFailedUrls((urls) => [...urls, current.url])}
            className="object-contain"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#F2EEF3] px-6 text-center text-[#746978]">
            <HiPhoto aria-hidden="true" className="size-12" />
            <p className="text-sm">Product image unavailable</p>
          </div>
        )}

        {media.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Previous product image"
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md border border-[#D5CDD8] bg-white/95 text-[#35293A] opacity-100 shadow-[0_2px_8px_rgba(35,20,41,0.1)] focus-visible:outline-3 focus-visible:outline-[#E6007A] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              <HiChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Next product image"
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md border border-[#D5CDD8] bg-white/95 text-[#35293A] opacity-100 shadow-[0_2px_8px_rgba(35,20,41,0.1)] focus-visible:outline-3 focus-visible:outline-[#E6007A] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            >
              <HiChevronRight aria-hidden="true" className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      {media.length > 1 ? (
        <div className="marketplace-scroll mt-3 flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Product image thumbnails">
          {media.map((item, index) => (
            <button
              key={item.id ?? item.url}
              type="button"
              role="listitem"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Show image ${index + 1}: ${item.altText}`}
              aria-current={index === selectedIndex ? "true" : undefined}
              className={`relative size-16 shrink-0 overflow-hidden rounded-md border-2 bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A] sm:size-[72px] ${
                index === selectedIndex ? "border-[#E6007A]" : "border-transparent"
              }`}
            >
              {failedUrls.includes(item.url) ? (
                <HiPhoto aria-hidden="true" className="absolute inset-0 m-auto size-5 text-[#8B808F]" />
              ) : (
                <Image
                  src={item.url}
                  alt=""
                  fill
                  sizes="72px"
                  onError={() => setFailedUrls((urls) => [...urls, item.url])}
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
