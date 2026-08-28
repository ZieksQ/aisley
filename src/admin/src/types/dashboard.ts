import type { RegistrationRole } from './registrations'

export type DashboardRegistrationAction = {
  id: string
  role: RegistrationRole
  submitted_at: string
}

export type DashboardRegistrationOverview = {
  pending: {
    total: number
    by_role: Record<RegistrationRole, number>
  }
  action_items: DashboardRegistrationAction[]
}

export type DashboardData = {
  registrations: DashboardRegistrationOverview | null
  generated_at: string
}

export type DashboardResponse = {
  data: DashboardData
}
