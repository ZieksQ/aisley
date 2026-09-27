export type ServiceType = 'first_mile' | 'linehaul' | 'last_mile'

export type ProductCategoryOption = {
  id: string
  name: string
  group_name: string | null
}

export type RegionSurcharge = {
  id: string
  destination_region: string
  surcharge_cents: number
}

export type PlatformTariff = {
  id: string
  version_number: number
  status: string
  currency: 'PHP'
  base_fee_cents: number
  volumetric_divisor: number
  max_weight_grams: number
  max_length_mm: number
  max_width_mm: number
  max_height_mm: number
  effective_at: string
  published_at: string | null
  region_surcharges: RegionSurcharge[]
}

export type TariffAcceptance = {
  rate: PlatformTariff
  accepted: boolean
  accepted_at: string | null
}

export type RateRule = {
  id: string
  category_id: string
  service_type: ServiceType
  base_charge_cents: number
  included_weight_grams: number
  additional_weight_grams: number
  additional_fee_cents: number
  max_weight_grams: number
  max_length_mm: number
  max_width_mm: number
  max_height_mm: number
  category: { id: string; name: string } | null
}

export type RateCard = {
  id: string
  version_number: number
  status: 'draft' | 'published' | 'archived'
  currency: 'PHP'
  effective_at: string
  published_at: string | null
  revision: number
  rules: RateRule[]
}

export type RuleDraft = {
  key: string
  categoryId: string
  serviceType: ServiceType
  baseCharge: string
  includedWeightKg: string
  additionalWeightKg: string
  additionalFee: string
  maxWeightKg: string
  maxLengthCm: string
  maxWidthCm: string
  maxHeightCm: string
}

export type RateCardDraft = {
  effectiveAt: string
  rules: RuleDraft[]
}

