type AnalyticsProperties = Record<string, boolean | number | string | null>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackMarketplaceEvent(
  event: string,
  properties: AnalyticsProperties = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const detail = { event, ...properties };
  window.dataLayer?.push(detail);
  window.dispatchEvent(new CustomEvent("aisley:analytics", { detail }));
}
