import regionsIndex from "@aisley/psgc-address-data/data/list-of-all-regions.json";

export type PsgcAddressOption = {
  code: string;
  name: string;
};

export type PsgcLevel = "regions" | "provinces" | "municipalities" | "barangays";

type PsgcNode = {
  children?: PsgcNode[];
  geographic_level?: string;
  name?: string;
  psgc_code?: string;
};

type RegionIndexEntry = {
  file: string;
  name: string;
  psgc_code: string;
};

type RegionPayload = {
  region?: PsgcNode;
};

const regionLoaders: Record<string, () => Promise<RegionPayload>> = {
  "0100000000": () => import("@aisley/psgc-address-data/data/0100000000-region-i-ilocos-region/addresses.json").then(({ default: data }) => data as RegionPayload),
  "0200000000": () => import("@aisley/psgc-address-data/data/0200000000-region-ii-cagayan-valley/addresses.json").then(({ default: data }) => data as RegionPayload),
  "0300000000": () => import("@aisley/psgc-address-data/data/0300000000-region-iii-central-luzon/addresses.json").then(({ default: data }) => data as RegionPayload),
  "0400000000": () => import("@aisley/psgc-address-data/data/0400000000-region-iv-a-calabarzon/addresses.json").then(({ default: data }) => data as RegionPayload),
  "0500000000": () => import("@aisley/psgc-address-data/data/0500000000-region-v-bicol-region/addresses.json").then(({ default: data }) => data as RegionPayload),
  "0600000000": () => import("@aisley/psgc-address-data/data/0600000000-region-vi-western-visayas/addresses.json").then(({ default: data }) => data as RegionPayload),
  "0700000000": () => import("@aisley/psgc-address-data/data/0700000000-region-vii-central-visayas/addresses.json").then(({ default: data }) => data as RegionPayload),
  "0800000000": () => import("@aisley/psgc-address-data/data/0800000000-region-viii-eastern-visayas/addresses.json").then(({ default: data }) => data as RegionPayload),
  "0900000000": () => import("@aisley/psgc-address-data/data/0900000000-region-ix-zamboanga-peninsula/addresses.json").then(({ default: data }) => data as RegionPayload),
  "1000000000": () => import("@aisley/psgc-address-data/data/1000000000-region-x-northern-mindanao/addresses.json").then(({ default: data }) => data as RegionPayload),
  "1100000000": () => import("@aisley/psgc-address-data/data/1100000000-region-xi-davao-region/addresses.json").then(({ default: data }) => data as RegionPayload),
  "1200000000": () => import("@aisley/psgc-address-data/data/1200000000-region-xii-soccsksargen/addresses.json").then(({ default: data }) => data as RegionPayload),
  "1300000000": () => import("@aisley/psgc-address-data/data/1300000000-national-capital-region-ncr/addresses.json").then(({ default: data }) => data as RegionPayload),
  "1400000000": () => import("@aisley/psgc-address-data/data/1400000000-cordillera-administrative-region-car/addresses.json").then(({ default: data }) => data as RegionPayload),
  "1600000000": () => import("@aisley/psgc-address-data/data/1600000000-region-xiii-caraga/addresses.json").then(({ default: data }) => data as RegionPayload),
  "1700000000": () => import("@aisley/psgc-address-data/data/1700000000-mimaropa-region/addresses.json").then(({ default: data }) => data as RegionPayload),
  "1800000000": () => import("@aisley/psgc-address-data/data/1800000000-negros-island-region-nir/addresses.json").then(({ default: data }) => data as RegionPayload),
  "1900000000": () => import("@aisley/psgc-address-data/data/1900000000-bangsamoro-autonomous-region-in-muslim-mindanao-barmm/addresses.json").then(({ default: data }) => data as RegionPayload),
};

const regionCache = new Map<string, Promise<PsgcNode>>();

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error("The address options request was aborted.");
    error.name = "AbortError";
    throw error;
  }
}

function sortedOptions(items: PsgcNode[]): PsgcAddressOption[] {
  return items
    .filter((item) => item.psgc_code && item.name)
    .map((item) => ({ code: item.psgc_code as string, name: item.name as string }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
}

function regionEntry(code: string) {
  return (regionsIndex as RegionIndexEntry[]).find((entry) => entry.psgc_code === code);
}

async function loadRegion(code: string, signal?: AbortSignal) {
  throwIfAborted(signal);

  let cached = regionCache.get(code);
  if (!cached) {
    const loader = regionLoaders[code];
    const entry = regionEntry(code);
    if (!loader || !entry) throw new Error("The requested address region is unavailable.");

    cached = loader().then((payload) => {
      if (!payload.region || payload.region.psgc_code !== entry.psgc_code) {
        throw new Error("The requested address region data is invalid.");
      }
      return payload.region;
    });
    regionCache.set(code, cached);
  }

  const region = await cached;
  throwIfAborted(signal);
  return region;
}

function directChild(parent: PsgcNode, code: string, levels: string[]) {
  const child = (parent.children ?? []).find(
    (item) => item.psgc_code === code && levels.includes(item.geographic_level ?? ""),
  );
  if (!child) throw new Error("The requested address option is unavailable.");
  return child;
}

function childOptions(parent: PsgcNode, levels: string[]) {
  return sortedOptions(
    (parent.children ?? []).filter((item) => levels.includes(item.geographic_level ?? "")),
  );
}

function descendantOptions(parent: PsgcNode, level: string) {
  const matches: PsgcNode[] = [];
  const visit = (node: PsgcNode) => {
    for (const child of node.children ?? []) {
      if (child.geographic_level === level) matches.push(child);
      else visit(child);
    }
  };
  visit(parent);
  return sortedOptions(matches);
}

export async function fetchPsgcOptions(
  level: PsgcLevel,
  filters: Record<string, string> = {},
  signal?: AbortSignal,
) {
  throwIfAborted(signal);

  if (level === "regions") return sortedOptions(regionsIndex as RegionIndexEntry[]);

  const region = await loadRegion(filters.reg ?? "", signal);
  if (level === "provinces") return childOptions(region, ["province"]);

  let parent = region;
  if (filters.prv) parent = directChild(region, filters.prv, ["province"]);
  if (level === "municipalities") return childOptions(parent, ["city", "municipality"]);

  const municipality = directChild(parent, filters.mun ?? "", ["city", "municipality"]);
  return descendantOptions(municipality, "barangay");
}
