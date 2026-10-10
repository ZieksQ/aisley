import type { Terms, Failure } from './types'

export const statuses = [
  'draft',
  'scheduled',
  'active',
  'paused',
  'expired',
  'exhausted',
  'ended',
] as const
export const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1)
export const money = (value: string | number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(
    Number(value),
  )
export const date = (value: string) =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
export const localDate = (value: string) =>
  new Date(new Date(value).getTime() + 8 * 3600000).toISOString().slice(0, 16)
export const utcDate = (value: string) =>
  new Date(`${value}:00+08:00`).toISOString()
export const benefit = (terms: Terms) =>
  `${terms.value_type === 'percent' ? `${terms.value}%` : money(terms.value)} ${terms.benefit_type === 'shipping' ? 'shipping saving' : 'merchandise discount'}${terms.maximum_discount ? `, capped at ${money(terms.maximum_discount)}` : ''}`
export const denied = (error: Failure) =>
  error.status === 401 ||
  error.status === 403 ||
  error.code === 'POLICY_CONSENT_REQUIRED'
export const uncertain = (error: Failure) =>
  !error.status || error.status >= 500 || error.name === 'AbortError'
export const funding = (role: 'admin' | 'seller') =>
  role === 'admin'
    ? 'The platform funds these savings. Seller and Logistics proceeds are preserved.'
    : 'Your Shop funds this discount through reduced merchandise proceeds before commission. Settlement applies no second deduction.'

export type FormValues = {
  distribution_mode: 'automatic' | 'claim_required'
  name: string
  code: string
  benefit_type: Terms['benefit_type']
  value_type: Terms['value_type']
  value: string
  maximum_discount: string
  minimum_spend: string
  starts_at: string
  ends_at: string
  global_limit: string
  per_customer_limit: string
  terms_summary: string
}
export function formValues(terms?: Terms): FormValues {
  return {
    distribution_mode: terms?.distribution_mode ?? 'claim_required',
    name: terms?.name ?? terms?.code ?? '',
    code: terms?.code ?? '',
    benefit_type: terms?.benefit_type ?? 'discount',
    value_type: terms?.value_type ?? 'fixed',
    value: terms?.value ?? '',
    maximum_discount: terms?.maximum_discount ?? '',
    minimum_spend: terms?.minimum_spend ?? '0.00',
    starts_at: localDate(terms?.starts_at ?? new Date().toISOString()),
    ends_at: localDate(
      terms?.ends_at ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    ),
    global_limit: terms?.global_limit?.toString() ?? '',
    per_customer_limit: terms?.per_customer_limit.toString() ?? '1',
    terms_summary: terms?.terms_summary ?? '',
  }
}
export function payload(
  values: FormValues,
  revision: number,
  original?: Terms,
): Record<string, unknown> {
  return {
    ...values,
    code: values.code || null,
    revision,
    currency: 'PHP',
    payment_method: 'cod',
    maximum_discount: values.maximum_discount || null,
    global_limit: values.global_limit ? Number(values.global_limit) : null,
    per_customer_limit: Number(values.per_customer_limit),
    starts_at:
      original && values.starts_at === localDate(original.starts_at)
        ? original.starts_at
        : utcDate(values.starts_at),
    ends_at:
      original && values.ends_at === localDate(original.ends_at)
        ? original.ends_at
        : utcDate(values.ends_at),
  }
}
