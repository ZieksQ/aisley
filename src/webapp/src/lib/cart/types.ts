export type CartSelectedOption = {
  group: string;
  value: string;
};

export type CartItem = {
  id: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  product: {
    id: string;
    slug: string;
    name: string;
    url: string;
  };
  variant: {
    id: string;
    sku: string;
  } | null;
  selectedOptions: CartSelectedOption[];
  media: {
    url: string | null;
    altText: string;
  };
  availability: {
    isAvailable: boolean;
    reason:
      | "product_unavailable"
      | "variant_unavailable"
      | "out_of_stock"
      | "insufficient_stock"
      | null;
    availableQuantity: number;
  };
};

export type CustomerCart = {
  id: string;
  itemCount: number;
  distinctItemCount: number;
  subtotal: number;
  availableSubtotal: number;
  items: CartItem[];
};

export type AddCartItemPayload = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
};

export type UpdateCartItemPayload = {
  quantity?: number;
  variant_id?: string | null;
};
