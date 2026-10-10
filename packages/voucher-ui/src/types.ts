export type Terms = {
  distribution_mode?: 'automatic' | 'claim_required'
  name: string
  code: string
  benefit_type: 'discount' | 'shipping'
  value_type: 'fixed' | 'percent'
  value: string
  maximum_discount: string | null
  minimum_spend: string
  starts_at: string
  ends_at: string
  global_limit: number | null
  per_customer_limit: number
  payment_method: 'cod' | null
  eligibility_scope?: 'unrestricted' | 'legacy_targeted'
  eligibility_rules: Record<string, string[]> | [] | null
  stacking_policy: { allow_with?: string[] } | null
  terms_summary: string
}
export type VoucherStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'expired'
  | 'exhausted'
  | 'ended'
export type Voucher = {
  id: string
  name: string
  code: string
  benefit_type: Terms['benefit_type']
  lifecycle: 'draft' | 'published' | 'ended'
  status: VoucherStatus
  revision: number
  version: number
  is_active: boolean
  authoring_supported: boolean
  terms: Terms
  draft: { id: string; number: number; terms: Terms } | null
  redeemed_count: number
  remaining_capacity: number | null
  customer_savings: string
}
export type Page<T> = {
  data: T[]
  meta: { current_page: number; last_page: number; total: number }
}
export type Request = <T>(path: string, options?: RequestInit) => Promise<T>
export type VoucherProps = {
  role: 'admin' | 'seller'
  prefix: string
  request: Request
  canManage: boolean
  navigate: (path: string, committed?: boolean) => void
  onGuardChange: (state: GuardState) => void
}
export type Failure = Error & {
  status?: number
  code?: string
  errors?: Record<string, string[]>
}
export type Mutation = {
  action: string
  path: string
  body: Record<string, unknown>
  key: string
  method: string
}

export type GuardState = { dirty: boolean; busy: boolean; uncertain: boolean }
