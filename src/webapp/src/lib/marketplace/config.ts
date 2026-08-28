function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (value === undefined || !/^\d+$/.test(value.trim())) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    return fallback;
  }

  return parsed;
}

const discoveryPageSize = boundedInteger(
  process.env.NEXT_PUBLIC_HOMEPAGE_DISCOVERY_PAGE_SIZE,
  20,
  8,
  50,
);

export const marketplaceConfig = {
  discoveryPageSize,
  discoveryMaxItems: Math.max(
    discoveryPageSize,
    boundedInteger(
      process.env.NEXT_PUBLIC_HOMEPAGE_DISCOVERY_MAX_ITEMS,
      120,
      8,
      500,
    ),
  ),
};
