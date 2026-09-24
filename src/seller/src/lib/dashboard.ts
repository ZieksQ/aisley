import { apiRequest } from './api'
import type { DashboardResponse } from '../types/dashboard'

export type DashboardPeriodFilter = {
  from: string
  to: string
  timezone: string
}

export function fetchSellerDashboard(filters: Partial<DashboardPeriodFilter>, signal: AbortSignal) {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.timezone) params.set('timezone', filters.timezone)

  const query = params.toString()
  return apiRequest<DashboardResponse>(`/api/v1/seller/dashboard${query ? `?${query}` : ''}`, { signal })
}
