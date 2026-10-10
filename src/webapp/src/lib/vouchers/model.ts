import type { CustomerVoucher, VoucherFilters, VoucherPage } from "./types";

export const money = (value: string) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(value),
  );
export const voucherDate = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const benefit = (voucher: CustomerVoucher) =>
  voucher.valueType === "percent"
    ? `${Number(voucher.value)}%`
    : money(voucher.value);
export const availabilityReasons: Record<string, string> = {
  VOUCHER_INACTIVE: "Paused by the issuer. Check back later.",
  VOUCHER_NOT_STARTED: "Available when the validity period starts.",
  VOUCHER_EXPIRED: "This voucher has expired.",
  VOUCHER_ENDED: "The issuer has ended this offer.",
  VOUCHER_EXHAUSTED: "All redemptions have been used.",
  VOUCHER_CUSTOMER_LIMIT: "You have used your personal allowance.",
  VOUCHER_CUSTOMER_INELIGIBLE:
    "This voucher is not available for your account.",
  VOUCHER_SHOP_UNAVAILABLE: "The issuing shop is currently unavailable.",
  VOUCHER_PAYMENT_INELIGIBLE:
    "This voucher is not available for cash on delivery.",
  VOUCHER_TERMS_INVALID: "This offer is temporarily unavailable.",
};

export function filterParameters(filters: VoucherFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined) params.set(key, String(value));
  return params;
}

export function parseVoucherFilters(
  parameters: Record<string, string | string[] | undefined>,
): { filters: VoucherFilters; error: string | null } {
  const filters: VoucherFilters = {};
  for (const [key, value] of Object.entries(parameters)) {
    if (
      value === undefined ||
      (value === "" && ["issuer", "benefit"].includes(key))
    )
      continue;
    if (Array.isArray(value))
      return { filters, error: "Choose one value for each filter." };
    if (key === "issuer" && ["app", "shop"].includes(value))
      filters.issuer = value as VoucherFilters["issuer"];
    else if (key === "benefit" && ["discount", "shipping"].includes(value))
      filters.benefit = value as VoucherFilters["benefit"];
    else if (
      key === "page" &&
      /^\d+$/.test(value) &&
      Number(value) >= 1 &&
      Number(value) <= 10000
    )
      filters.page = Number(value);
    else
      return {
        filters,
        error:
          "The voucher filter is not supported. Reset the filters and try again.",
      };
  }
  return { filters, error: null };
}

export function parseVoucher(value: unknown): CustomerVoucher {
  if (!value || typeof value !== "object")
    throw new Error("Voucher data could not be read. Try again.");
  const v = value as CustomerVoucher;
  const strings = [
    v.id,
    v.name,
    v.code,
    v.value,
    v.minimumSpend,
    v.validFrom,
    v.validUntil,
  ];
  if (
    !strings.every((field) => typeof field === "string") ||
    v.currency !== "PHP" ||
    !/^\d+\.\d{2}$/.test(v.value) ||
    !/^\d+\.\d{2}$/.test(v.minimumSpend) ||
    !(
      v.maximumDiscount === null ||
      (typeof v.maximumDiscount === "string" &&
        /^\d+\.\d{2}$/.test(v.maximumDiscount))
    ) ||
    !(v.termsSummary === null || typeof v.termsSummary === "string") ||
    !(
      v.collectionUrl === null ||
      (typeof v.collectionUrl === "string" &&
        /^\/(vouchers|shops)\//.test(v.collectionUrl))
    ) ||
    !(
      v.availabilityReason === null || typeof v.availabilityReason === "string"
    ) ||
    !(v.collected === null || typeof v.collected === "boolean") ||
    !(
      v.collectedAt === null ||
      (typeof v.collectedAt === "string" &&
        Number.isFinite(Date.parse(v.collectedAt)))
    ) ||
    !(
      v.remainingPersonalUses === null ||
      (Number.isInteger(v.remainingPersonalUses) &&
        v.remainingPersonalUses >= 0)
    ) ||
    !(
      v.walletStatus === null ||
      ["available", "upcoming", "history"].includes(v.walletStatus)
    ) ||
    !(
      v.shop === null ||
      (typeof v.shop === "object" &&
        [v.shop.id, v.shop.name, v.shop.slug].every(
          (field) => typeof field === "string",
        ))
    ) ||
    !["app", "shop"].includes(v.issuerType) ||
    !["discount", "shipping"].includes(v.benefitType) ||
    !["fixed", "percent"].includes(v.valueType) ||
    !["automatic", "claim_required"].includes(v.distributionMode) ||
    typeof v.canCollect !== "boolean" ||
    !v.scope ||
    ![
      v.scope.productIds,
      v.scope.categoryIds,
      v.scope.excludedProductIds,
      v.scope.excludedCategoryIds,
    ].every(
      (ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string"),
    ) ||
    !Number.isFinite(Date.parse(v.validFrom)) ||
    !Number.isFinite(Date.parse(v.validUntil))
  ) {
    throw new Error("Voucher data could not be read. Try again.");
  }
  return v;
}

export function parseVoucherPage(value: unknown): VoucherPage {
  const page = value as VoucherPage;
  if (
    !page ||
    !Array.isArray(page.items) ||
    !page.pagination ||
    ![
      page.pagination.currentPage,
      page.pagination.lastPage,
      page.pagination.perPage,
      page.pagination.total,
    ].every(Number.isInteger) ||
    page.pagination.currentPage < 1 ||
    page.pagination.lastPage < 1 ||
    page.pagination.perPage < 1 ||
    page.pagination.perPage > 50 ||
    page.pagination.total < 0
  ) {
    throw new Error("Voucher results could not be read. Try again.");
  }
  return { items: page.items.map(parseVoucher), pagination: page.pagination };
}
