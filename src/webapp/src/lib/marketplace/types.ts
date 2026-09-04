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
  description?: string | null;
  slot?: string | null;
  position?: number;
};

export type HomepageAdvertisementLayer = {
  layout: "single" | "carousel" | "multi_block" | "multi_block_carousel";
  rotationIntervalSeconds: number;
  primary: HomepageCampaign[];
  secondaryTop: HomepageCampaign | null;
  secondaryBottom: HomepageCampaign | null;
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
  advertisementLayer: HomepageAdvertisementLayer | null;
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

export type Pagination = {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
};

export type ShopCategorySummary = {
  id: string;
  slug: string;
  name: string;
};

export type ShopSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  category: ShopCategorySummary | null;
};

export type ShopDetail = ShopSummary;

export type ShopDirectoryResponse = {
  items: ShopSummary[];
  categories: ShopCategorySummary[];
  pagination: Pagination;
};

export type ShopBrowseResponse = {
  shop: ShopDetail;
  categories: ShopCategorySummary[];
  items: ProductSummary[];
  pagination: Pagination;
};

export type RecentlyViewedItem = {
  id: string;
  lastViewedAt: string;
  product: ProductSummary;
};

export type RecentlyViewedPage = {
  data: RecentlyViewedItem[];
  links: { next: string | null; prev: string | null };
  meta: {
    next_cursor: string | null;
    path: string;
    per_page: number;
    prev_cursor: string | null;
  };
};

export type GuestRecentlyViewedEntry = {
  productId: string;
  viewedAt: string;
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
