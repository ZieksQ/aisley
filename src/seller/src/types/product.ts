export interface ProductVariant {
  id: string;
  name: string; // e.g. "Size: M / Color: Rose Noir"
  sku: string;
  price: number;
  stock: number;
}

export interface Product {
  id: string;
  title: string;
  sku: string;
  category: string;
  description: string;
  basePrice: number;
  compareAtPrice?: number;
  costOfGoods: number;
  stock: number;
  lowStockThreshold: number;
  status: 'active' | 'archived' | 'draft';
  imageUrl: string;
  images: string[];
  variants: ProductVariant[];
  sizes: string[];
  colors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Voucher {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number; // e.g. 15 for 15% or 500 for ₱500
  minSpend: number;
  maxDiscount?: number;
  usageLimit: number;
  usageCount: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'scheduled' | 'expired';
}
