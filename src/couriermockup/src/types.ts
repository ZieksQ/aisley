export interface CourierUser {
  id: string
  email: string
  role: string
  status: string
  profile?: {
    first_name: string | null
    last_name: string | null
    age: number | null
  }
  logistics?: {
    status: string | null
    organization: string | null
    hub: string | null
  }
}

export interface CourierAccount {
  id: string
  email: string
  role: string | null
  status: string | null
  profile: {
    first_name: string | null
    middle_name: string | null
    last_name: string | null
    contact_number: string | null
    sex: string | null
    birth_date: string | null
    age: number | null
    profile_photo_url: string | null
  }
  affiliation: {
    status: string | null
    organization_name: string | null
    hub_name: string | null
  }
  security: {
    email_editable: boolean
    profile_photo_editable: boolean
    password_change_requires_current_password: boolean
  }
}

export interface DashboardSection {
  state: string
  reason?: string
}

export interface CourierDashboard {
  data: unknown[]
  meta: {
    next_cursor: string | null
    generated_at: string
  }
  sections: {
    notifications: DashboardSection
    available_tasks: DashboardSection
    active_tasks: DashboardSection
  }
  freshness: {
    state: string
    reason?: string
    generated_at: string
  }
}

export interface LoginResponse {
  token: string
  courier: CourierUser
}

export interface MeResponse {
  courier: CourierUser
}

export interface AccountResponse {
  account: CourierAccount
  message?: string
}

export interface FirstMileTask {
  id: string
  status: 'assigned' | 'accepted' | 'picked_up_from_seller'
  picked_up_at: string | null
  order: { id: string; reference: string }
  waybill: { reference: string }
  pickup: {
    shop_name: string
    contact_number: string
    address_line_1: string
    address_line_2: string | null
    barangay: string
    city_municipality: string
    province: string
    region: string
    postal_code: string
    latitude: string | number | null
    longitude: string | number | null
  } | null
  destination_area: {
    city_municipality: string
    province: string
    region: string
  } | null
  schedule: {
    id: string
    reference: string
    starts_at: string
    ends_at: string
    timezone: 'UTC'
  }
}

export interface FirstMileTaskListResponse {
  data: FirstMileTask[]
  meta: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export interface PickupConfirmationResponse {
  data: {
    task_id: string
    order: { id: string; reference: string }
    waybill: { reference: string }
    task_status: 'picked_up_from_seller'
    order_status: string
    picked_up_at: string
    next_step: 'logistics_receipt'
    idempotent: boolean
  }
}

export interface WaybillResolveResponse {
  data: {
    waybill_reference: string
    order_reference: string
    task: FirstMileTask
    matched: true
  }
}

export interface PickupRouteStop {
  sequence: number
  node_id: string
  kind: 'hub' | 'pickup'
  address_summary: string
  latitude: number
  longitude: number
  coordinate_source: 'exact' | 'address_default'
  leg_distance_metres: number | null
  leg_duration_seconds: number | null
  reachable: boolean
  tasks: Array<{
    task_id: string
    order_id: string
    order_reference: string
    waybill_reference: string
  }>
}

export interface PickupRouteManifest {
  status: 'pending' | 'ready' | 'unavailable'
  schedule: {
    id: string
    reference: string
    starts_at: string
    ends_at: string
    timezone: 'UTC'
    order_count: number
  }
  revision: number
  coordinate_source: 'exact' | 'address_default' | 'mixed' | null
  summary: {
    pickup_stop_count: number
    parcel_count: number
    unreachable_stop_count: number
    distance_metres: number | null
    duration_seconds: number | null
    estimated_credits: number
    heuristic: 'nearest_next_stop'
    returns_to_hub: true
  }
  stops: PickupRouteStop[]
  geojson: {
    type: 'FeatureCollection'
    features: Array<{
      type: 'Feature'
      geometry: { type: 'Point' | 'LineString'; coordinates: number[] | number[][] }
      properties: Record<string, string | number | boolean>
    }>
  } | null
  calculated_at: string | null
  reason: string | null
  map: {
    style_url: string
    attribution: string[]
  }
}

export interface PickupRouteManifestResponse {
  data: PickupRouteManifest
}

export interface ApiErrorPayload {
  code?: string
  message?: string
  errors?: Record<string, string[]>
}
