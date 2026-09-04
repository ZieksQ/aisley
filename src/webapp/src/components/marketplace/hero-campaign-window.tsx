"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiPause, FiPlay } from "react-icons/fi";

import type { HomepageAdvertisementLayer, HomepageCampaign } from "@/lib/marketplace/types";

import { CampaignImage } from "./campaign-image";
import { useHomeData } from "./home-data-provider";

function campaignContent(
  campaign: HomepageCampaign,
  priority: boolean,
  compact = false,
) {
  return (
    <>
      <CampaignImage
        desktopSrc={campaign.imageDesktopUrl}
        mobileSrc={campaign.imageMobileUrl}
        alt={campaign.altText}
        priority={priority}
      />
      {!campaign.imageDesktopUrl ? (
        <div className="relative z-10 flex h-full items-end bg-[#4C1268] p-6 text-white">
          <p className={compact ? "text-lg font-bold" : "max-w-lg text-3xl font-bold"}>
            {campaign.title ?? "Discover more on Aisley"}
          </p>
        </div>
      ) : campaign.title || campaign.description ? (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-black/55 px-4 py-3 text-white sm:px-6 sm:py-4">
          {campaign.title ? (
            <p className={compact ? "text-base font-semibold" : "text-xl font-bold sm:text-2xl"}>
              {campaign.title}
            </p>
          ) : null}
          {campaign.description ? (
            <p className={`mt-1 leading-5 text-white/90 ${compact ? "line-clamp-2 text-xs" : "max-w-xl text-sm sm:text-base"}`}>
              {campaign.description}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function CampaignLink({
  campaign,
  children,
  className,
  position,
}: {
  campaign: HomepageCampaign;
  children: React.ReactNode;
  className: string;
  position: number;
}) {
  if (!campaign.destinationUrl) {
    return <div className={className}>{children}</div>;
  }

  return (
    <Link
      href={campaign.destinationUrl}
      className={`${className} focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]`}
      data-analytics-event="homepage_hero_click"
      data-analytics-campaign-id={campaign.id}
      data-analytics-position={position}
    >
      {children}
    </Link>
  );
}

export function HeroCampaignWindow() {
  const { data } = useHomeData();
  const layer: HomepageAdvertisementLayer | null = data.advertisementLayer;
  const heroCampaigns = data.campaigns.hero;
  const sideCampaigns = data.campaigns.side;
  const campaigns = (layer?.primary ?? heroCampaigns).filter((campaign) => campaign.isActive);
  const visibleSideCampaigns = layer ? [layer.secondaryTop, layer.secondaryBottom].filter((campaign): campaign is HomepageCampaign => Boolean(campaign)) : sideCampaigns.filter((campaign) => campaign.isActive);
  const hasSideCampaigns = layer ? layer.layout === "multi_block" || layer.layout === "multi_block_carousel" : visibleSideCampaigns.length > 0;
  const isCarousel = layer ? layer.layout === "carousel" || layer.layout === "multi_block_carousel" : true;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const visibleIndex = campaigns.length > 0 ? activeIndex % campaigns.length : 0;

  useEffect(() => {
    if (!isCarousel || campaigns.length < 2 || isPaused) {
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches || document.hidden) {
      return;
    }

    const interval = window.setInterval(() => {
      if (!document.hidden) {
        setActiveIndex((index) => (index + 1) % campaigns.length);
      }
    }, (layer?.rotationIntervalSeconds ?? 6) * 1000);

    return () => window.clearInterval(interval);
  }, [campaigns.length, isCarousel, isPaused, layer?.rotationIntervalSeconds]);

  const activeCampaign = campaigns[visibleIndex];

  return (
    <section
      aria-label="Marketplace campaigns"
      className={`grid gap-3 ${
        hasSideCampaigns
          ? "lg:grid-cols-[minmax(0,2.1fr)_minmax(260px,1fr)]"
          : ""
      }`}
    >
      <div
        className={`relative aspect-[2/3] min-h-[220px] overflow-hidden rounded-[10px] bg-[#4C1268] sm:aspect-[4/3] sm:min-h-[280px] lg:aspect-video lg:min-h-0 ${
          hasSideCampaigns ? "" : "lg:aspect-[16/5]"
        }`}
        onFocusCapture={() => setIsPaused(true)}
        onPointerEnter={() => setIsPaused(true)}
      >
        {activeCampaign ? (
          <CampaignLink
            campaign={activeCampaign}
            className="absolute inset-0 block"
            position={visibleIndex + 1}
          >
            {campaignContent(activeCampaign, visibleIndex === 0)}
          </CampaignLink>
        ) : (
          <div className="absolute inset-0 flex items-center bg-[#4C1268] px-6 py-8 text-white sm:px-10">
            <div className="max-w-lg">
              <p className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                Find it on Aisley
              </p>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/85 sm:text-base">
                Browse everyday essentials, useful upgrades, and new finds from
                marketplace sellers.
              </p>
              <Link
                href="/search?q=best+sellers"
                className="mt-6 inline-flex min-h-10 items-center rounded-md bg-white px-4 text-sm font-bold text-[#4C1268] hover:bg-[#F6F0F8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Browse popular products
              </Link>
            </div>
          </div>
        )}

        {isCarousel && campaigns.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous campaign"
              onClick={() =>
                setActiveIndex((visibleIndex - 1 + campaigns.length) % campaigns.length)
              }
              className="absolute left-3 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-md bg-white/95 text-[#3B2B40] shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
            >
              <FiChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next campaign"
              onClick={() => setActiveIndex((visibleIndex + 1) % campaigns.length)}
              className="absolute right-3 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-md bg-white/95 text-[#3B2B40] shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
            >
              <FiChevronRight aria-hidden="true" className="size-5" />
            </button>
            <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-2">
              {campaigns.map((campaign, index) => (
                <button
                  key={campaign.id}
                  type="button"
                  aria-label={`Show campaign ${index + 1}: ${campaign.title ?? campaign.altText ?? "Advertisement"}`}
                  aria-current={index === visibleIndex ? "true" : undefined}
                  onClick={() => setActiveIndex(index)}
                  className={`h-1 rounded-sm transition-[width,background-color] ${
                    index === visibleIndex ? "w-7 bg-white" : "w-4 bg-white/55"
                  } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
                />
              ))}
              <button
                type="button"
                aria-label={isPaused ? "Resume campaign rotation" : "Pause campaign rotation"}
                onClick={() => setIsPaused((value) => !value)}
                className="ml-1 flex size-7 items-center justify-center rounded-md bg-[#231429]/65 text-white hover:bg-[#231429]/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {isPaused ? (
                  <FiPlay aria-hidden="true" className="size-3.5" />
                ) : (
                  <FiPause aria-hidden="true" className="size-3.5" />
                )}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {hasSideCampaigns ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-rows-2">
          {visibleSideCampaigns
            .slice(0, 2)
            .map((campaign, index) => (
            <CampaignLink
              key={campaign.id}
              campaign={campaign}
              className="relative block min-h-0 overflow-hidden rounded-lg bg-[#F2EAF4]"
              position={index + 1}
            >
              {campaignContent(campaign, false, true)}
            </CampaignLink>
            ))}
        </div>
      ) : null}
    </section>
  );
}
