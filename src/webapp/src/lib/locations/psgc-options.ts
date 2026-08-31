import { apiRequest } from "@/lib/api";

export type PsgcAddressOption = {
  code: string;
  name: string;
};

type PsgcLevel = "regions" | "provinces" | "municipalities" | "barangays";

export async function fetchPsgcOptions(
  level: PsgcLevel,
  filters: Record<string, string> = {},
  signal?: AbortSignal,
) {
  const query = new URLSearchParams(filters);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await apiRequest<{ options: PsgcAddressOption[] }>(
    `/api/v1/address-options/${level}${suffix}`,
    { signal },
  );

  return response.options;
}
