export type LogisticsServiceType = 'first_mile' | 'linehaul' | 'last_mile'

export type FinanceHoldAllocation = {
  logistics_organization_id: string
  service_type: LogisticsServiceType
  amount_cents: number
}

export type FinanceHold = {
  id: string
  reason_code: string
  reason_label: string
  notes: string | null
  placed_at: string
  released_at: string | null
  is_open: boolean
  order: {
    id: string
    reference: string
    status: string
    currency: string
    shop_name: string | null
    selected_logistics_organization: { id: string; business_name: string } | null
  } | null
  pricing: {
    pricing_model: 'platform_base_v1' | 'logistics_service_base_v1'
    route_status: string
    logistics_pool_cents: number
    quoted_shipping_fee_cents: number
    base_fee_cents: number
    additional_weight_fee_cents: number
    destination_surcharge_cents: number
    billable_weight_grams: number
    destination: {
      region: string | null
      province: string | null
      city_municipality: string | null
    }
  } | null
  reconciliation: {
    id: string
    shipping_pool_cents: number
    platform_subsidy_cents: number
    total_allocation_cents: number
    allocations: FinanceHoldAllocation[]
    notes: string
    reconciled_at: string
  } | null
}

export type LogisticsOrganizationOption = {
  id: string
  business_name: string
  hub_name: string | null
}

export type FinanceHoldDetailResponse = {
  data: FinanceHold
  organizations: LogisticsOrganizationOption[]
}

export type FinanceHoldPageResponse = {
  data: FinanceHold[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export type ReconcileFinanceHoldPayload = {
  platform_subsidy_cents: number
  notes: string
  allocations: FinanceHoldAllocation[]
}
