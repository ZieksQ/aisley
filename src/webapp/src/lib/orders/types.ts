export type CustomerOrderGroup =
  | "to_pay"
  | "to_prepare"
  | "to_ship"
  | "out_for_delivery"
  | "completed"
  | "cancelled_issue";

export type CustomerOrderStatus =
  | "pending_payment"
  | "placed"
  | "seller_processing"
  | "ready_for_pickup"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "rejected"
  | "delivery_failed"
  | "return_requested"
  | "returned";

export type OrderActions = {
  canCancel: boolean;
  canModify: boolean;
  canReview: boolean;
  modifiableFields: string[];
};

export type OrderTotals = {
  merchandiseSubtotal: string;
  shippingFee: string;
  discount: string;
  shippingDiscount: string;
  payable: string;
  currency: string;
};

export type OrderShop = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
};

export type OrderSummary = {
  id: string;
  reference: string;
  shop: OrderShop;
  itemPreview: {
    productId: string | null;
    productName: string;
    variantName: string | null;
    quantity: number;
  } | null;
  lineCount: number;
  itemCount: number;
  status: CustomerOrderStatus;
  statusLabel: string;
  group: CustomerOrderGroup;
  groupLabel: string;
  latestTrackingAt: string;
  totals: OrderTotals;
  actions: OrderActions;
  detailUrl: string;
};

export type PaginationMeta = {
  current_page: number;
  from: number | null;
  last_page: number;
  path: string;
  per_page: number;
  to: number | null;
  total: number;
};

export type OrderListResponse = {
  data: OrderSummary[];
  filters: {
    selected: CustomerOrderGroup | null;
    tabs: Array<{ value: CustomerOrderGroup | null; label: string }>;
  };
  meta: PaginationMeta;
};

export type OrderTimelineEvent = {
  id: string;
  status: CustomerOrderStatus;
  label: string;
  eventType: string | null;
  location: { hub?: string; city?: string };
  occurredAt: string;
};

export type OrderMap = {
  available: boolean;
  state: "unavailable" | "loading" | "stale" | "fresh" | string;
  message: string;
  currentPosition: {
    latitude: number | string;
    longitude: number | string;
    label?: string;
  } | null;
  route: unknown;
  capturedAt: string | null;
};

export type OrderDetail = {
  id: string;
  reference: string;
  checkoutBatchId: string;
  placedAt: string;
  latestTrackingAt: string;
  status: CustomerOrderStatus;
  statusLabel: string;
  group: CustomerOrderGroup;
  groupLabel: string;
  shop: OrderShop;
  items: Array<{
    id: string;
    productId: string | null;
    variantId: string | null;
    productName: string;
    variantName: string | null;
    sku: string | null;
    selectedOptions: Array<{ group: string; value: string }>;
    unitPrice: string;
    quantity: number;
    lineSubtotal: string;
    currency: string;
  }>;
  deliveryAddress: {
    recipientName: string;
    contactNumber: string;
    addressLine1: string;
    addressLine2: string | null;
    barangay: string;
    cityMunicipality: string;
    province: string;
    region: string;
    postalCode: string;
    country: string;
  };
  payment: { method: "cod"; status: string };
  vouchers: Array<{
    id: string | null;
    code: string;
    issuerType: string;
    benefitType: string;
    discountAmount: string;
    currency: string;
    termsSummary: string | null;
  }>;
  totals: OrderTotals;
  timeline: OrderTimelineEvent[];
  timelineCount: number;
  timelineHasMore: boolean;
  trackingUrl: string;
  map: OrderMap;
  actions: OrderActions;
};

export type OrderTrackingResponse = {
  data: OrderTimelineEvent[];
  meta: PaginationMeta;
};

export const customerOrderGroups: CustomerOrderGroup[] = [
  "to_pay",
  "to_prepare",
  "to_ship",
  "out_for_delivery",
  "completed",
  "cancelled_issue",
];

export function isCustomerOrderGroup(
  value: string | null | undefined,
): value is CustomerOrderGroup {
  return customerOrderGroups.includes(value as CustomerOrderGroup);
}
