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

export interface ApiErrorPayload {
  code?: string
  message?: string
  errors?: Record<string, string[]>
}
