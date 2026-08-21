export type OrderStatus =
  | 'new'
  | 'to_pack'
  | 'courier_handover'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  id: string;
  productId: string;
  productTitle: string;
  sku: string;
  variantName?: string;
  unitPrice: number;
  costOfGoods: number;
  quantity: number;
  imageUrl: string;
}

export interface CustomerAddress {
  fullName: string;
  phone: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
}

export interface CustomerReview {
  id: string;
  orderId: string;
  productId: string;
  productTitle: string;
  customerName: string;
  rating: number; // 1-5
  comment: string;
  photos?: string[];
  createdAt: string;
  sellerReply?: {
    message: string;
    repliedAt: string;
  };
}

export interface Order {
  id: string; // e.g. "ORD-9021"
  orderNumber: string;
  trackingNumber?: string;
  waybillNumber?: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: CustomerAddress;
  items: OrderItem[];
  subtotal: number;
  voucherDiscount: number;
  voucherCode?: string;
  shippingFee: number;
  shippingSubsidy: number;
  platformFeeRate: number; // e.g. 0.035 (3.5%)
  platformFee: number; // e.g. subtotal * 0.035
  netSellerPayout: number; // subtotal - platformFee - shippingSubsidy
  totalAmount: number; // subtotal - voucherDiscount + shippingFee
  paymentMethod: 'GCash' | 'Maya' | 'Card' | 'COD';
  paymentStatus: 'paid' | 'pending';
  status: OrderStatus;
  courier?: {
    name: 'J&T Express' | 'Flash Express' | 'Aisley Express' | 'Lalamove';
    scheduledPickupDate?: string;
    scheduledTimeSlot?: string;
    courierNotes?: string;
  };
  customerNotes?: string;
  createdAt: string;
  updatedAt: string;
}
