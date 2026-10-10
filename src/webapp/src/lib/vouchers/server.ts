import "server-only";
import { publicApiResult } from "@/lib/marketplace/server";
import { filterParameters, parseVoucher, parseVoucherPage } from "./model";
import type { VoucherFilters } from "./types";

export async function publicVouchers(
  filters: VoucherFilters = {},
  slug?: string,
) {
  const path = slug
    ? `/shops/${encodeURIComponent(slug)}/vouchers`
    : "/vouchers";
  const result = await publicApiResult<unknown>(
    `/api/v1/customer${path}?${filterParameters(filters)}`,
  );
  if (result.status !== "success") return result;
  try {
    return { status: "success" as const, data: parseVoucherPage(result.data) };
  } catch {
    return { status: "error" as const };
  }
}

export async function publicVoucher(id: string) {
  const result = await publicApiResult<{ data: unknown }>(
    `/api/v1/customer/vouchers/${encodeURIComponent(id)}`,
  );
  if (result.status !== "success") return result;
  try {
    return { status: "success" as const, data: parseVoucher(result.data.data) };
  } catch {
    return { status: "error" as const };
  }
}
