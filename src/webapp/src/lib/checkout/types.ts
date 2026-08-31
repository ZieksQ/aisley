export type CheckoutMode = "cart" | "buy_now";

export type CheckoutIntent =
  | { mode: "cart"; cartItemIds: string[] }
  | {
      mode: "buy_now";
      productId: string;
      variantId: string | null;
      quantity: number;
    };

export type CustomerAddress = {
  id: string;
  type: "shipping" | "billing" | "both";
  label: string | null;
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
  latitude: string | null;
  longitude: string | null;
  isDefault: boolean;
};

export type AddressPayload = {
  type: "shipping" | "billing" | "both";
  label: string | null;
  recipient_name: string;
  contact_number: string;
  address_line_1: string;
  address_line_2: string | null;
  barangay: string;
  city_municipality: string;
  province: string;
  region: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

export type CreateAddressPayload = AddressPayload;

export type VoucherSelection = {
  voucher_id: string;
  target_shop_id: string;
};

export type CheckoutRequestPayload = {
  mode: CheckoutMode;
  address_id: string;
  payment_method: "cod";
  vouchers: VoucherSelection[];
  cart_item_ids?: string[];
  buy_now?: {
    product_id: string;
    variant_id: string | null;
    quantity: number;
  };
};

export type CheckoutVoucher = {
  id: string;
  code: string;
  issuerType: "app" | "shop";
  benefitType: "discount" | "shipping";
  valueType: "fixed" | "percent";
  value: string;
  maximumDiscount: string | null;
  minimumSpend: string;
  termsSummary: string | null;
  validFrom: string;
  validUntil: string;
  paymentMethod: "cod" | null;
  stackableWith: string[];
  scope: {
    productIds: string[];
    categoryIds: string[];
    excludedProductIds: string[];
    excludedCategoryIds: string[];
  };
  eligible: boolean;
  reason: string | null;
  saving: string;
};

export type CheckoutTotals = {
  merchandiseSubtotal: string;
  shippingFee: string;
  discount: string;
  shippingDiscount: string;
  payable: string;
  currency: string;
};

export type CheckoutQuote = {
  quoteId: string;
  expiresAt: string;
  mode: CheckoutMode;
  paymentMethod: "cod";
  address: CustomerAddress;
  groups: Array<{
    shop: { id: string; name: string };
    items: Array<{
      cartItemId: string | null;
      productId: string;
      variantId: string | null;
      productName: string;
      sku: string;
      selectedOptions: Array<{ group: string; value: string }>;
      unitPrice: string;
      quantity: number;
      lineSubtotal: string;
    }>;
    availableVouchers: CheckoutVoucher[];
    appliedVouchers: Array<{
      id: string;
      code: string;
      issuerType: "app" | "shop";
      benefitType: "discount" | "shipping";
      qualifyingBasis: string;
      discountAmount: string;
    }>;
    totals: CheckoutTotals;
  }>;
  summary: CheckoutTotals & { orderCount: number };
};

export type CheckoutBatch = {
  id: string;
  currency: string;
  placedAt: string;
  orders: Array<{
    id: string;
    reference: string;
    status: string;
    paymentMethod: "cod";
    paymentStatus: string;
    shop: { id: string; name: string };
    items: Array<{
      id: string;
      productId: string;
      variantId: string | null;
      productName: string;
      variantName: string | null;
      sku: string;
      selectedOptions: Array<{ group: string; value: string }>;
      unitPrice: string;
      quantity: number;
      lineSubtotal: string;
      currency: string;
    }>;
    address: Omit<CustomerAddress, "id" | "label" | "type" | "isDefault">;
    vouchers: Array<{
      id: string;
      code: string;
      issuerType: "app" | "shop";
      benefitType: "discount" | "shipping";
      qualifyingBasis: string;
      discountAmount: string;
      termsSummary: string | null;
    }>;
    totals: CheckoutTotals;
    detailUrl: string;
  }>;
};
