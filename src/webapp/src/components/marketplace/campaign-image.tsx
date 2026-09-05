"use client";

import { getImageProps } from "next/image";
import { memo, useState } from "react";

type CampaignImageProps = {
  alt: string | null;
  desktopSrc: string | null;
  mobileSrc: string | null;
  priority?: boolean;
};

export const CampaignImage = memo(function CampaignImage({
  alt,
  desktopSrc,
  mobileSrc,
  priority = false,
}: CampaignImageProps) {
  const sourceKey = `${desktopSrc ?? ""}|${mobileSrc ?? ""}`;
  const [failedSourceKey, setFailedSourceKey] = useState<string | null>(null);

  if (!desktopSrc || failedSourceKey === sourceKey) {
    return null;
  }

  const loading = priority ? "eager" : "lazy";
  const fetchPriority = priority ? "high" : "auto";
  const desktop = getImageProps({
    alt: alt ?? "",
    fill: true,
    fetchPriority,
    loading,
    sizes: "(max-width: 1023px) 100vw, 900px",
    src: desktopSrc,
  });
  const mobile = mobileSrc
    ? getImageProps({
        alt: alt ?? "",
        fill: true,
        fetchPriority,
        loading,
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
        alt={alt ?? ""}
        onError={() => setFailedSourceKey(sourceKey)}
        className="absolute inset-0 size-full object-cover"
      />
    </picture>
  );
});

CampaignImage.displayName = "CampaignImage";
