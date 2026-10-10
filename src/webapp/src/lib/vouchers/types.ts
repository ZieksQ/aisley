import type { Pagination } from "@/lib/marketplace/types";

export type CustomerVoucher = {
  id: string;
  name: string;
  code: string;
  issuerType: "app" | "shop";
  benefitType: "discount" | "shipping";
  valueType: "fixed" | "percent";
  value: string;
  maximumDiscount: string | null;
  minimumSpend: string;
  currency: "PHP";
  validFrom: string;
  validUntil: string;
  paymentMethod: "cod" | null;
  termsSummary: string | null;
  distributionMode: "automatic" | "claim_required";
  scope: {
    productIds: string[];
    categoryIds: string[];
    excludedProductIds: string[];
    excludedCategoryIds: string[];
  };
  shop: { id: string; name: string; slug: string } | null;
  collectionUrl: string | null;
  collectedAt: string | null;
  collected: boolean | null;
  remainingPersonalUses: number | null;
  availabilityReason: string | null;
  canCollect: boolean;
  walletStatus: "available" | "upcoming" | "history" | null;
};
export type VoucherPage = { items: CustomerVoucher[]; pagination: Pagination };
export type VoucherFilters = {
  issuer?: "app" | "shop";
  benefit?: "discount" | "shipping";
  page?: number;
  status?: "available" | "upcoming" | "history";
};
