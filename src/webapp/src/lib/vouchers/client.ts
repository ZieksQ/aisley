import { ApiError, initializeCsrf } from "@/lib/api";
import {
  reportSessionFailure,
  sessionRevision,
} from "@/lib/auth/session-events";
import { filterParameters, parseVoucher, parseVoucherPage } from "./model";
import type { CustomerVoucher, VoucherFilters } from "./types";

export class VoucherError extends ApiError {
  retryAt: number;
  constructor(
    status: number,
    payload: { code?: string; message?: string },
    retryAfter: string | null,
  ) {
    super(status, payload);
    const seconds =
      retryAfter && /^\d+$/.test(retryAfter)
        ? Number(retryAfter)
        : retryAfter
          ? (Date.parse(retryAfter) - Date.now()) / 1000
          : 60;
    this.retryAt =
      status === 429
        ? Date.now() +
          Math.max(1, Number.isFinite(seconds) ? seconds : 60) * 1000
        : 0;
  }
}

async function request(
  path: string,
  method = "GET",
  signal?: AbortSignal,
  publicRead = false,
): Promise<unknown> {
  const revision = sessionRevision();
  const deadline = AbortSignal.timeout(15000);
  const bounded = signal ? AbortSignal.any([signal, deadline]) : deadline;
  if (method === "POST") await initializeCsrf(bounded);
  if (revision !== sessionRevision())
    throw new Error(
      "Your account changed. Open the voucher again before collecting.",
    );
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  const token = publicRead
    ? undefined
    : document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith("XSRF-TOKEN="));
  if (token)
    headers["X-XSRF-TOKEN"] = decodeURIComponent(
      token.slice("XSRF-TOKEN=".length),
    );
  const base = (
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
  ).replace(/\/$/, "");
  const response = await fetch(`${base}/api/v1/customer${path}`, {
    method,
    headers,
    credentials: publicRead ? "omit" : "include",
    cache: "no-store",
    signal: bounded,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (!publicRead)
      reportSessionFailure(
        `/api/v1/customer${path}`,
        response.status,
        payload?.code,
        revision,
      );
    throw new VoucherError(
      response.status,
      payload ?? { message: "Voucher request failed. Try again." },
      response.headers.get("Retry-After"),
    );
  }
  return payload;
}

export async function voucherStatuses(ids: string[], signal?: AbortSignal) {
  const parameters = new URLSearchParams();
  ids.forEach((id) => parameters.append("ids[]", id));
  const response = (await request(
    `/voucher-statuses?${parameters}`,
    "GET",
    signal,
  )) as { items: unknown[] };
  if (!response || !Array.isArray(response.items))
    throw new Error("Voucher status could not be checked. Try again.");
  return response.items.map(parseVoucher);
}

export async function myVouchers(
  filters: VoucherFilters,
  signal?: AbortSignal,
) {
  return parseVoucherPage(
    await request(`/my-vouchers?${filterParameters(filters)}`, "GET", signal),
  );
}

export async function collectVoucher(voucher: CustomerVoucher, slug?: string) {
  const path = slug
    ? `/shops/${encodeURIComponent(slug)}/vouchers/${voucher.id}/claim`
    : `/vouchers/${voucher.id}/claim`;
  const response = (await request(path, "POST")) as { data: unknown };
  const collected = parseVoucher(response?.data);
  if (
    collected.id !== voucher.id ||
    (collected.distributionMode === "claim_required" && !collected.collected)
  )
    throw new Error("Collection was not confirmed. Retry Collect safely.");
  return collected;
}

export async function shopVouchers(
  slug: string,
  page: number,
  signal?: AbortSignal,
) {
  return parseVoucherPage(
    await request(
      `/shops/${encodeURIComponent(slug)}/vouchers?page=${page}`,
      "GET",
      signal,
      true,
    ),
  );
}
