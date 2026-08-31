export type ComplianceCaseStatus = 'open' | 'confirmed' | 'dismissed' | 'closed'
export type ComplianceActionType = 'case_dismissed' | 'case_closed' | 'warning_issued' | 'product_restricted' | 'product_restriction_revoked' | 'seller_suspension_referred'

export type ComplianceSeller = {
  id: string
  email: string
  name: string
  status: 'pending' | 'active' | 'rejected' | 'suspended' | 'deactivated'
  shop_name: string | null
}

export type ComplianceProduct = {
  id: string
  name: string
  status: 'draft' | 'active' | 'archived'
  is_restricted: boolean
}

export type CompliancePolicy = {
  id: string
  title: string
  version: number
  type: string
}

export type ComplianceCaseSummary = {
  id: string
  status: ComplianceCaseStatus
  reason: string
  revision: number
  seller: ComplianceSeller
  product: ComplianceProduct | null
  policy: CompliancePolicy | null
  created_by: { id: string; email: string }
  created_at: string
  updated_at: string
}

export type ComplianceAction = {
  id: string
  action: ComplianceActionType
  label: string
  reason: string
  actor: { id: string; email: string }
  restriction_id: string | null
  account_lifecycle_event_id: string | null
  occurred_at: string
}

export type ComplianceRestriction = {
  id: string
  reason: string
  is_active: boolean
  imposed_at: string
  revoked_at: string | null
  revocation_reason: string | null
}

export type ComplianceCaseDetail = ComplianceCaseSummary & {
  source: { type: string; reference_id: string | null }
  dismissal_note: string | null
  confirmed_at: string | null
  dismissed_at: string | null
  closed_at: string | null
  actions: ComplianceAction[]
  restrictions: ComplianceRestriction[]
}

export type ComplianceCaseResponse = { data: ComplianceCaseDetail; meta: { request_id: string } }
export type ComplianceCaseListResponse = {
  data: ComplianceCaseSummary[]
  links: { first: string | null; last: string | null; prev: string | null; next: string | null }
  meta: { current_page: number; from: number | null; last_page: number; per_page: number; to: number | null; total: number }
}

export type ComplianceOptionsResponse = {
  data: {
    sellers: ComplianceSeller[]
    products: ComplianceProduct[]
    policies: CompliancePolicy[]
  }
}

export type ComplianceActionName = 'dismiss' | 'warn' | 'restrict-product' | 'revoke-product-restriction' | 'suspend-seller' | 'close'
