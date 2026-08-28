"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiArrowRight } from "react-icons/fi";

import { useHomeData } from "./home-data-provider";
import { ProductCard } from "./product-card";

function remainingParts(endsAt: string, currentTime: number) {
  const remaining = Math.max(0, Date.parse(endsAt) - currentTime);
  const seconds = Math.floor(remaining / 1000);

  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    total: remaining,
  };
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}

export function FlashDealsSection() {
  const { data, refresh } = useHomeData();
  const deal = data.flashDeals;
  const [currentTime, setCurrentTime] = useState(0);
  const clock = deal && currentTime > 0
    ? remainingParts(deal.endsAt, currentTime)
    : null;

  useEffect(() => {
    if (!deal) {
      return;
    }

    const frame = window.requestAnimationFrame(() => setCurrentTime(Date.now()));
    const interval = window.setInterval(() => {
      const nextTime = Date.now();
      const nextClock = remainingParts(deal.endsAt, nextTime);
      setCurrentTime(nextTime);

      if (nextClock.total === 0) {
        window.clearInterval(interval);
        void refresh();
      }
    }, 1000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, [deal, refresh]);

  const countdown = useMemo(() => {
    if (!clock) {
      return "--:--:--";
    }

    return `${twoDigits(clock.hours)}:${twoDigits(clock.minutes)}:${twoDigits(clock.seconds)}`;
  }, [clock]);

  if (!deal || clock?.total === 0 || deal.products.length === 0) {
    return null;
  }

  return (
    <section id="flash-deals" aria-labelledby="flash-deals-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2
            id="flash-deals-heading"
            className="text-xl font-bold tracking-[-0.02em] text-[#E6007A]"
          >
            {deal.title || "Flash Deals"}
          </h2>
          <div className="flex items-center gap-2 text-sm text-[#5B4F5F]">
            <span>Ends in</span>
            <time
              dateTime={deal.endsAt}
              className="rounded-md bg-[#301037] px-2 py-1 font-mono text-sm font-bold tabular-nums text-white"
            >
              {countdown}
            </time>
          </div>
        </div>
        <Link
          href="/flash-deals"
          className="flex items-center gap-1 text-sm font-semibold text-[#4C1268] hover:text-[#E6007A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
        >
          See all deals
          <FiArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <div className="marketplace-scroll grid snap-x snap-mandatory grid-flow-col auto-cols-[44%] gap-3 overflow-x-auto pb-2 sm:auto-cols-[30%] lg:auto-cols-[19%] xl:auto-cols-[16%]">
        {deal.products.map((product, index) => (
          <div key={product.id} className="snap-start">
            <ProductCard
              product={product}
              position={index + 1}
              section="flash_deals"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
