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
  support_tickets: DashboardQueueSummary | null
  seller_compliance: DashboardQueueSummary | null
  generated_at: string
}

export type DashboardQueueSummary = {
  filter: { status: 'open' }
  destination: string
} & ({ state: 'ready'; count: number } | { state: 'unavailable'; count: null })

export type DashboardResponse = {
  data: DashboardData
}
