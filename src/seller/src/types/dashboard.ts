export type OrderActivity = {
  state: 'available' | 'empty'
  metrics: { awaiting_approval: number; processing: number; ready_for_pickup: number; delivered: number }
  by_status: Record<string, number>
  daily_placed: { date: string; count: number }[]
  timezone: 'UTC'
  from: string
  to: string
}

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

export type ReviewSection = {
  state: 'available' | 'empty'
  metrics: {
    total: number
    answered: number
    unanswered: number
  }
  cohort: 'published_at'
} | {
  state: 'error'
  reason: 'REVIEW_SUMMARY_UNAVAILABLE'
}

export type DashboardPeriod = {
  from: string | null
  to: string | null
  timezone: string
  from_utc: string | null
  to_utc_exclusive: string | null
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
  period: DashboardPeriod
  sections: {
    order_activity?: OrderActivity | UnavailableSection
    catalog: CatalogSection | UnavailableSection
    financial: UnavailableSection
    orders: UnavailableSection
    inventory: UnavailableSection
    reviews: ReviewSection | UnavailableSection
    traffic: UnavailableSection
    notifications: UnavailableSection
  }
  actions: Array<never>
  generated_at: string
}
