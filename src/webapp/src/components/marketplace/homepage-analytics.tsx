"use client";

import { useEffect } from "react";

import { trackMarketplaceEvent } from "@/lib/marketplace/analytics";

import { useHomeData } from "./home-data-provider";

export function HomepageAnalytics() {
  const { data } = useHomeData();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) {
        return;
      }

      const trackedElement = event.target.closest<HTMLElement>(
        "[data-analytics-event]",
      );

      if (!trackedElement?.dataset.analyticsEvent) {
        return;
      }

      const properties = Object.fromEntries(
        Object.entries(trackedElement.dataset)
          .filter(([key]) => key.startsWith("analytics") && key !== "analyticsEvent")
          .map(([key, value]) => [
            key
              .replace(/^analytics/, "")
              .replace(/^[A-Z]/, (letter) => letter.toLowerCase())
              .replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
            value ?? "",
          ]),
      );

      trackMarketplaceEvent(trackedElement.dataset.analyticsEvent, {
        ...properties,
        is_authenticated: data.viewer.isAuthenticated,
      });
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [data.viewer.isAuthenticated]);

  return null;
}
