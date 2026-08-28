export type HomepageViewer = {
  isAuthenticated: boolean;
  displayName: string | null;
  deliveryLocation: {
    id: string;
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
