import { apiRequest } from './api'

export type CampaignStatus = 'draft' | 'preparing' | 'queued' | 'sending' | 'completed' | 'partially_failed' | 'failed'
export type CampaignInput = {
  title: string
  body: string
  audience_key: 'opted_in_customers'
  destination_type: 'product' | 'shop' | null
  destination_id: string | null
}
export const emptyCampaign: CampaignInput = {
  title: '', body: '', audience_key: 'opted_in_customers', destination_type: null, destination_id: null,
}
export type Campaign = CampaignInput & {
  id: string
  audience_label: string
  status: CampaignStatus
  revision: number
  preview: { eligible_count: number; calculated_at: string; revision: number } | null
  snapshot_count: number
  delivered_count: number
  skipped_count: number
  failed_count: number
  confirmed_at: string | null
  completed_at: string | null
  created_at: string
}
export type CampaignPreview = {
  audience_label: string
  eligible_count: number
  calculated_at: string
  dispatch_allowed: boolean
  revision: number
}

const path = '/api/v1/admin/notification-campaigns'

export const listCampaigns = (page = 1) => apiRequest<{ data: Campaign[]; meta: { current_page: number; last_page: number; total: number } }>(`${path}?page=${page}`)
export const getCampaign = (id: string) => apiRequest<{ data: Campaign }>(`${path}/${id}`)
export const createCampaign = (input: CampaignInput) => apiRequest<{ data: Campaign }>(path, { method: 'POST', body: JSON.stringify(input) })
export const updateCampaign = (id: string, input: CampaignInput, revision: number) => apiRequest<{ data: Campaign }>(`${path}/${id}`, { method: 'PATCH', body: JSON.stringify({ ...input, revision }) })
export const previewCampaign = (id: string, revision: number) => apiRequest<{ data: CampaignPreview }>(`${path}/${id}/preview`, { method: 'POST', body: JSON.stringify({ revision }) })
export const sendCampaign = (id: string, revision: number, key: string) => apiRequest<{ data: Campaign }>(`${path}/${id}/send`, {
  method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ revision, confirmation: true }),
})
