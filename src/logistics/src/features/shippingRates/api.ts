import { csrf, requestWithTimeout } from '../../lib/api'
import type { ProductCategoryOption, RateCard, RateCardDraft, RuleDraft, ServiceDraft, TariffAcceptance } from './types'

type RateCardsResponse = {
  data: RateCard[]
  meta: { categories: ProductCategoryOption[] }
}

const positiveNumber = (value: string) => Number(value)
const cents = (value: string) => Math.round(positiveNumber(value) * 100)
const grams = (value: string) => Math.round(positiveNumber(value) * 1000)
const millimeters = (value: string) => Math.round(positiveNumber(value) * 10)
const servicePayload = (service: ServiceDraft) => ({
  service_type: service.serviceType,
  base_fee_cents: cents(service.baseFee),
})

export async function loadShippingRates() {
  const [tariffs, cards] = await Promise.all([
    requestWithTimeout<{ data: TariffAcceptance[] }>('/api/v1/logistics/shipping-rates'),
    requestWithTimeout<RateCardsResponse>('/api/v1/logistics/rate-cards'),
  ])

  return { tariffs: tariffs.data, cards: cards.data, categories: cards.meta.categories }
}

export async function acceptTariff(id: string) {
  await csrf()
  await requestWithTimeout(`/api/v1/logistics/shipping-rates/${id}/accept`, { method: 'POST' })
}

export async function publishRateCard(id: string) {
  await csrf()
  await requestWithTimeout(`/api/v1/logistics/rate-cards/${id}/publish`, { method: 'POST' })
}

function rulePayload(rule: RuleDraft) {
  return {
    category_id: rule.categoryId,
    service_type: rule.serviceType,
    included_weight_grams: grams(rule.includedWeightKg),
    additional_weight_grams: grams(rule.additionalWeightKg),
    additional_fee_cents: cents(rule.additionalFee),
    max_weight_grams: grams(rule.maxWeightKg),
    max_length_mm: millimeters(rule.maxLengthCm),
    max_width_mm: millimeters(rule.maxWidthCm),
    max_height_mm: millimeters(rule.maxHeightCm),
  }
}

export async function createRateCard(draft: RateCardDraft) {
  await csrf()
  return requestWithTimeout<{ data: RateCard }>('/api/v1/logistics/rate-cards', {
    method: 'POST',
    body: JSON.stringify({
      currency: 'PHP',
      effective_at: new Date(draft.effectiveAt).toISOString(),
      services: draft.services.map(servicePayload),
      rules: draft.rules.map(rulePayload),
    }),
  })
}
