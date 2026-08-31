export type ManagedUserRole = 'customer' | 'seller' | 'courier'
export type ManagedUserStatus = 'pending' | 'active' | 'rejected' | 'suspended' | 'deactivated'
export type LifecycleAction = 'suspended' | 'restored' | 'deactivated'

export type ManagedUserSummary = {
  id: string
  display_name: string
  email: string
  role: ManagedUserRole
  status: ManagedUserStatus
  created_at: string | null
  status_changed_at: string | null
}

export type ManagedUserDetail = ManagedUserSummary & {
  profile: {
    first_name: string | null
    middle_name: string | null
    last_name: string | null
    contact_number: string | null
  }
  registration: {
    id: string
    status: string
    submitted_at: string | null
    reviewed_at: string | null
  } | null
  role_summary: {
    shop_id?: string
    shop_name?: string
    shop_status?: string
    vehicle_count?: number
  } | null
}

export type AccountLifecycleEvent = {
  id: string
  action: LifecycleAction
  action_label: string
  previous_status: ManagedUserStatus
  new_status: ManagedUserStatus
  reason: string | null
  actor: { id: string; name: string }
  source_feature: string
  source_reference_type: string | null
  source_reference_id: string | null
  occurred_at: string | null
}

type PaginationMeta = {
  current_page: number
  from: number | null
  last_page: number
  per_page: number
  to: number | null
  total: number
}

export type ManagedUserListResponse = {
  data: ManagedUserSummary[]
  meta: PaginationMeta
}

export type ManagedUserDetailResponse = { data: ManagedUserDetail }

export type AccountLifecycleHistoryResponse = {
  data: AccountLifecycleEvent[]
  meta: PaginationMeta
}
