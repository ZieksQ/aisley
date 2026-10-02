import { apiRequest } from './api'
import type { DashboardResponse } from '../types/dashboard'

export function fetchDashboard(signal: AbortSignal) {
  return apiRequest<DashboardResponse>('/api/v1/admin/dashboard', {
    cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  })
}
