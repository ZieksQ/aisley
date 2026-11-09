import { requestWithTimeout } from '../../lib/api'
import type { Meta, MonitoringTrip, MonitoringHistory, MonitoringList, MonitoringTruck } from './types'
import type { AssignmentList } from './assignmentTypes'

const endpoint = '/api/v1/logistics/fleet/monitoring'
export const loadMonitoring = (query: string) => requestWithTimeout<MonitoringList>(`${endpoint}?${query}`)
export const loadAssignments = (query: string) => requestWithTimeout<AssignmentList>(`${endpoint}/assignments?${query}`)
export const loadTruck = (id: string) => requestWithTimeout<{ data: MonitoringTruck; meta: Meta }>(`${endpoint}/${encodeURIComponent(id)}`)
export const loadPastTransfers = (id: string, page: number) => requestWithTimeout<MonitoringHistory>(`${endpoint}/${encodeURIComponent(id)}/trips?past=1&page=${page}`)
export const loadPastTransfer = (truck: string, trip: string) => requestWithTimeout<{ data: MonitoringTrip; meta: Meta }>(`${endpoint}/${encodeURIComponent(truck)}/trips/${encodeURIComponent(trip)}`)
