export type PolicyType = 'terms_of_service' | 'privacy_policy'

export type PolicyConsentItem = {
  type: PolicyType
  label: string
  required: boolean
  accepted: boolean
  accepted_at: string | null
  current_version: {
    id: string
    version: number
    title: string
    change_summary: string | null
    requires_reconsent: boolean
    published_at: string | null
  } | null
  accepted_version: { id: string; version: number; accepted_at: string } | null
}

export type PolicyConsentStatusResponse = {
  data: { policies: PolicyConsentItem[]; all_required_accepted: boolean }
}

export type PolicyVersion = {
  id: string
  version: number
  title: string
  content: string
  status: 'published' | 'superseded'
  change_summary: string | null
  requires_reconsent: boolean
  published_at: string | null
}

export type PolicyDocumentResponse = { data: { type: PolicyType; label: string; version: PolicyVersion } }
export type PolicyAcceptanceResponse = { data: { type: PolicyType; label: string; version: PolicyVersion; accepted_at: string } }
