"use client";

import Image from "next/image";
import { useState } from "react";
import { FiShoppingBag } from "react-icons/fi";

export function ShopBanner({ name, bannerUrl }: { name: string; bannerUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="shop-banner">
      {bannerUrl && !failed ? (
        <Image
          src={bannerUrl}
          alt={`${name} shop banner`}
          fill
          priority
          sizes="(max-width: 1280px) 100vw, 1280px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="shop-banner-fallback">
          <FiShoppingBag aria-hidden="true" />
          <span>{name}</span>
        </div>
      )}
    </div>
  );
}
