export type PricingStatus = 'draft' | 'published'

export type RegionSurcharge = {
  id: string
  destination_region: string
  normalized_region: string
  surcharge_cents: number
}

export type ShippingRateVersion = {
  id: string
  version_number: number
  status: PricingStatus
  currency: 'PHP'
  volumetric_divisor: number
  max_weight_grams: number
  max_length_mm: number
  max_width_mm: number
  max_height_mm: number
  effective_at: string
  published_at: string | null
  revision: number
  acceptances_count: number
  region_surcharges: RegionSurcharge[]
  created_at: string
}

export type CommissionBeneficiary = 'seller' | 'logistics'
export type CommissionPolicyStatus = 'active' | 'scheduled' | 'inactive' | 'expired'

export type CommissionPolicy = {
  id: string
  beneficiary_type: CommissionBeneficiary
  rate_basis_points: number
  status: CommissionPolicyStatus
  can_publish: boolean
  effective_at: string | null
  ends_at: string | null
  published_at?: string | null
  revision: number
  created_at: string
}

export type ShippingRatePayload = {
  currency: 'PHP'
  effective_at: string
  region_surcharges: Array<{ region: string; surcharge_cents: number }>
}

export type CommissionPolicyPayload = {
  beneficiary_type: CommissionBeneficiary
  rate_basis_points: number
  effective_at: string | null
}
