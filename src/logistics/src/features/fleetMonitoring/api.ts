import { requestWithTimeout } from '../../lib/api'
import type { Meta, MonitoringDetail, MonitoringHistory, MonitoringList, MonitoringTruck } from './types'

const endpoint = '/api/v1/logistics/fleet/monitoring'
export const loadMonitoring = (query: string) => requestWithTimeout<MonitoringList>(`${endpoint}?${query}`)
export async function loadTruckMonitoring(id: string, page: number): Promise<MonitoringDetail> {
  const [detail, history] = await Promise.all([
    requestWithTimeout<{ data: MonitoringTruck; meta: Meta }>(`${endpoint}/${encodeURIComponent(id)}`),
    requestWithTimeout<MonitoringHistory>(`${endpoint}/${encodeURIComponent(id)}/trips?page=${page}`),
  ])
  return { ...detail, history }
}
