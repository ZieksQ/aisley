"use client";

import { getImageProps } from "next/image";
import { useState } from "react";

export function CampaignImage({
  alt,
  desktopSrc,
  mobileSrc,
  priority = false,
}: {
  alt: string;
  desktopSrc: string | null;
  mobileSrc: string | null;
  priority?: boolean;
}) {
  const sourceKey = `${desktopSrc ?? ""}|${mobileSrc ?? ""}`;
  const [failedSourceKey, setFailedSourceKey] = useState<string | null>(null);

  if (!desktopSrc || failedSourceKey === sourceKey) {
    return null;
  }

  const desktop = getImageProps({
    alt,
    fill: true,
    priority,
    sizes: "(max-width: 1023px) 100vw, 900px",
    src: desktopSrc,
  });
  const mobile = mobileSrc
    ? getImageProps({
        alt,
        fill: true,
        priority,
        sizes: "100vw",
        src: mobileSrc,
      })
    : null;

  return (
    <picture>
      {mobile ? (
        <source media="(max-width: 767px)" srcSet={mobile.props.srcSet} />
      ) : null}
      {/* next/image supplies the optimized srcset; picture selects the mobile asset. */}
      <img
        {...desktop.props}
        alt={alt}
        onError={() => setFailedSourceKey(sourceKey)}
        className="absolute inset-0 size-full object-cover"
      />
    </picture>
  );
}
