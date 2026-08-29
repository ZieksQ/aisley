export type HomepageViewer = {
  isAuthenticated: boolean;
  displayName: string | null;
  email: string | null;
  deliveryLocation: {
    id: string;
    label: string | null;
    cityMunicipality: string;
    province: string;
  } | null;
  cartItemCount: number;
};

export type HomepageCampaign = {
  id: string;
  placement: "hero" | "hero_side";
  title: string;
  imageDesktopUrl: string | null;
  imageMobileUrl: string | null;
  altText: string;
  destinationUrl: string | null;
  startsAt: string;
  endsAt: string;
  priority: number;
  isActive: boolean;
};

export type HomepageQuickAction = {
  key: string;
  label: string;
  destinationUrl: string;
};

export type HomepageCategory = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
};

export type ProductSummary = {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  originalPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  discountPercent: number | null;
  averageRating: number | null;
  reviewCount: number;
  soldCount: number;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock";
  shop: {
    id: string;
    slug: string;
    name: string;
  };
  badges: string[];
  deal?: {
    stock: number;
    soldCount: number;
    remainingStock: number;
    progressPercent: number;
  };
};

export type HomepageRecommendations = {
  items: ProductSummary[];
  nextCursor: string | null;
  pageSize: number;
};

export type FlashDeals = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  products: ProductSummary[];
};

export type HomepageData = {
  viewer: HomepageViewer;
  campaigns: {
    hero: HomepageCampaign[];
    side: HomepageCampaign[];
  };
  quickActions: HomepageQuickAction[];
  categories: HomepageCategory[];
  flashDeals: FlashDeals | null;
  topProducts: ProductSummary[];
  recentlyViewed: ProductSummary[];
  recommendations: HomepageRecommendations;
};

export type ProductSearchResponse = {
  query: string;
  items: ProductSummary[];
  pagination: {
    currentPage: number;
    lastPage: number;
    perPage: number;
    total: number;
  };
};

export type ProductMedia = {
  id: string | null;
  url: string;
  altText: string;
  position: number;
  variantId: string | null;
};

export type ProductOptionValue = {
  id: string;
  value: string;
  position: number;
  swatch: {
    color: string | null;
    imageUrl: string | null;
  };
};

export type ProductOptionGroup = {
  id: string;
  name: string;
  position: number;
  values: ProductOptionValue[];
};

export type ProductVariant = {
  id: string;
  sku: string;
  optionValueIds: string[];
  price: number;
  originalPrice: number | null;
  discountPercent: number | null;
  stockQuantity: number;
  inStock: boolean;
  primaryMediaId: string | null;
};

export type ProductDetail = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  descriptionMarkdown: string | null;
  specifications: Record<string, string | number | boolean | null> | null;
  price: number;
  originalPrice: number | null;
  discountPercent: number | null;
  badges: string[];
  averageRating: number | null;
  reviewCount: number;
  soldCount: number;
  availability: {
    inStock: boolean;
    stockQuantity: number | null;
    requiresVariantSelection: boolean;
  };
  media: ProductMedia[];
  optionGroups: ProductOptionGroup[];
  variants: ProductVariant[];
  shop: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    isOnVacation: boolean;
    vacationMessage: string | null;
    storefrontUrl: string;
  };
};
