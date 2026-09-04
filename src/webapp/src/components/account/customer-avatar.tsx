"use client";

import { useEffect, useState } from "react";

import { apiBlobRequest } from "@/lib/api";

function initials(name: string | null) {
  return (name ?? "A")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase();
}

export function CustomerAvatar({
  className = "size-9",
  displayName,
  photoUrl,
  decorative = false,
}: {
  className?: string;
  displayName: string | null;
  photoUrl: string | null | undefined;
  decorative?: boolean;
}) {
  const [loaded, setLoaded] = useState<{ source: string; objectUrl: string } | null>(null);
  const objectUrl = loaded && loaded.source === photoUrl ? loaded.objectUrl : null;

  useEffect(() => {
    if (!photoUrl) return;

    let active = true;
    let createdUrl: string | null = null;

    apiBlobRequest(photoUrl)
      .then((blob) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setLoaded({ source: photoUrl, objectUrl: createdUrl });
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [photoUrl]);

  if (objectUrl) {
    return (
      // The image uses an authenticated object URL and cannot use Next Image optimization.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={decorative ? "" : "Customer profile photo"}
        className={`${className} shrink-0 rounded-full object-cover`}
        src={objectUrl}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${className} grid shrink-0 place-items-center rounded-full bg-[#4C1268] text-xs font-bold uppercase text-white`}
    >
      {initials(displayName)}
    </span>
  );
}
