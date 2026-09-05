"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

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
      aria-label={`Open advertisement ${position}`}
      className={`${className} focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]`}
      data-analytics-event="homepage_hero_click"
      data-analytics-campaign-id={campaign.id}
      data-analytics-position={position}
    >
      {children}
    </Link>
  );
}

export function HeroCampaignWindow({
  heroCampaigns,
  sideCampaigns,
  advertisementLayer,
}: {
  heroCampaigns: HomepageCampaign[];
  sideCampaigns: HomepageCampaign[];
  advertisementLayer: HomepageAdvertisementLayer | null;
}) {
  const { data } = useHomeData();
  const layer: HomepageAdvertisementLayer | null = data.advertisementLayer ?? advertisementLayer;
  const campaigns = (layer?.primary ?? heroCampaigns).filter((campaign) => campaign.isActive);
  const visibleSideCampaigns = layer ? [layer.secondaryTop, layer.secondaryBottom].filter((campaign): campaign is HomepageCampaign => Boolean(campaign)) : sideCampaigns.filter((campaign) => campaign.isActive);
  const hasSideCampaigns = layer ? layer.layout === "multi_block" || layer.layout === "multi_block_carousel" : visibleSideCampaigns.length > 0;
  const isCarousel = layer ? layer.layout === "carousel" || layer.layout === "multi_block_carousel" : true;
  const canLoop = isCarousel && campaigns.length > 1;
  const [trackIndex, setTrackIndex] = useState(1);
  const [transitionDisabled, setTransitionDisabled] = useState(false);
  const visibleIndex = canLoop ? (trackIndex - 1 + campaigns.length) % campaigns.length : 0;
  const activeCampaign = campaigns[visibleIndex];
  const trackCampaigns = canLoop ? [campaigns[campaigns.length - 1], ...campaigns, campaigns[0]] : campaigns;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTransitionDisabled(true);
      setTrackIndex(1);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [campaigns.length, isCarousel]);

  useEffect(() => {
    if (!transitionDisabled) return;
    const frame = window.requestAnimationFrame(() => setTransitionDisabled(false));
    return () => window.cancelAnimationFrame(frame);
  }, [transitionDisabled]);

  useEffect(() => {
    if (!canLoop) return;
    const interval = window.setInterval(() => {
      setTrackIndex((index) => index + 1);
    }, (layer?.rotationIntervalSeconds ?? 6) * 1000);

    return () => window.clearInterval(interval);
  }, [canLoop, layer?.rotationIntervalSeconds]);

  function onTrackTransitionEnd(event: React.TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !canLoop) return;
    if (trackIndex === 0) {
      setTransitionDisabled(true);
      setTrackIndex(campaigns.length);
    } else if (trackIndex === campaigns.length + 1) {
      setTransitionDisabled(true);
      setTrackIndex(1);
    }
  }

  function showPrevious() {
    setTransitionDisabled(false);
    setTrackIndex((index) => index - 1);
  }

  function showNext() {
    setTransitionDisabled(false);
    setTrackIndex((index) => index + 1);
  }

  function showSlide(index: number) {
    setTransitionDisabled(false);
    setTrackIndex(index + 1);
  }

  return (
    <section
      aria-label="Marketplace advertisements"
      className={`grid gap-3 ${
        hasSideCampaigns
          ? "lg:grid-cols-[minmax(0,2.1fr)_minmax(260px,1fr)]"
          : ""
      }`}
    >
      <div className="relative h-[clamp(190px,38vh,280px)] min-h-0 overflow-hidden rounded-[10px] bg-[#4C1268] sm:h-[clamp(240px,38vh,340px)] lg:h-[clamp(300px,38vh,420px)]">
        {activeCampaign ? (
          <div
            className={`flex h-full ${transitionDisabled ? "" : "transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"}`}
            onTransitionEnd={onTrackTransitionEnd}
            style={{ transform: `translateX(-${canLoop ? trackIndex : 0}00%)` }}
          >
            {trackCampaigns.map((campaign, index) => {
              const campaignIndex = canLoop ? (index - 1 + campaigns.length) % campaigns.length : index;
              return (
                <CampaignLink
                  key={`${campaign.id}-${index}`}
                  campaign={campaign}
                  className="relative block h-full min-w-full shrink-0"
                  position={campaignIndex + 1}
                >
                  {campaignContent(campaign, canLoop ? index === 1 : campaignIndex === 0)}
                </CampaignLink>
              );
            })}
          </div>
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

        {canLoop ? (
          <>
            <button
              type="button"
              aria-label="Previous advertisement"
              onClick={showPrevious}
              className="absolute left-3 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-md bg-white/95 text-[#3B2B40] shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
            >
              <FiChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next advertisement"
              onClick={showNext}
              className="absolute right-3 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-md bg-white/95 text-[#3B2B40] shadow-[0_2px_8px_rgba(0,0,0,0.1)] hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#E6007A]"
            >
              <FiChevronRight aria-hidden="true" className="size-5" />
            </button>
            <div className="absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-2">
              {campaigns.map((campaign, index) => (
                <button
                  key={campaign.id}
                  type="button"
                  aria-label={`Show advertisement ${index + 1}`}
                  aria-current={index === visibleIndex ? "true" : undefined}
                  onClick={() => showSlide(index)}
                  className={`h-1 rounded-sm transition-[width,background-color] ${
                    index === visibleIndex ? "w-7 bg-white" : "w-4 bg-white/55"
                  } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {hasSideCampaigns ? (
        <div className="grid grid-cols-1 gap-3 lg:h-[clamp(300px,38vh,420px)] lg:grid-rows-2">
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
