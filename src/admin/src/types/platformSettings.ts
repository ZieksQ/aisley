export type AnnouncementStatus = 'draft' | 'published' | 'archived'
export type Announcement = {
  id: string
  title: string
  body: string
  status: AnnouncementStatus
  revision: number
  published_at: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

export type PolicyType = 'terms_of_service' | 'privacy_policy' | 'internal_rules'
export type PolicyVersion = {
  id: string
  version: number
  title: string
  content: string
  status: 'draft' | 'published' | 'superseded'
  requires_reconsent: boolean
  revision: number
  published_at: string | null
  created_at: string
}

export type Policy = {
  id: string | null
  type: PolicyType
  label: string
  current_version_id: string | null
  versions: PolicyVersion[]
}

export type Paginated<T> = { data: T[]; current_page: number; last_page: number; total: number }
