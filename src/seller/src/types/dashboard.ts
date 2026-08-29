export type CatalogSection = {
  state: 'available' | 'empty'
  metrics: {
    total: number
    active: number
    draft: number
    archived: number
    zero_stock_products: number
    zero_stock_skus: number
  }
  stock_signal: 'catalog_quantity'
}

export type UnavailableSection = {
  state: 'unavailable'
  reason: 'DOMAIN_NOT_IMPLEMENTED' | 'SHOP_SETUP_REQUIRED'
}

export type DashboardResponse = {
  version: 1
  code: 'SHOP_SETUP_REQUIRED' | null
  shop: {
    id: string
    name: string
    status: 'active' | 'suspended' | 'deactivated'
    is_on_vacation: boolean
  } | null
  period: {
    from: string | null
    to: string | null
    timezone: string
    from_utc: string | null
    to_utc_exclusive: string | null
  }
  sections: {
    catalog: CatalogSection | UnavailableSection
    financial: UnavailableSection
    orders: UnavailableSection
    inventory: UnavailableSection
    reviews: UnavailableSection
    traffic: UnavailableSection
    notifications: UnavailableSection
  }
  actions: Array<never>
  generated_at: string
}
